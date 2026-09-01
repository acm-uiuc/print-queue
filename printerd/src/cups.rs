use std::path::Path;

use ipp::{prelude::*, value::IppName};
use tokio_util::compat::TokioAsyncReadCompatExt;

use crate::{
    failure::Failure,
    protocol::{Duplex, Orientation, PrintOptions},
};

pub struct Cups {
    uri: Uri,
    client: AsyncIppClient,
}

impl Cups {
    pub fn new(uri: &str) -> Result<Self, Failure> {
        let uri: Uri = uri.parse().map_err(|error| {
            Failure::new("printer_unavailable", format!("invalid CUPS URI: {error}"))
        })?;
        Ok(Self {
            client: AsyncIppClient::new(uri.clone()),
            uri,
        })
    }

    pub async fn submit(
        &self,
        path: &Path,
        job_id: &str,
        options: &PrintOptions,
    ) -> Result<i32, Failure> {
        let file = tokio::fs::File::open(path)
            .await
            .map_err(Failure::internal)?;
        let operation =
            IppOperationBuilder::print_job(self.uri.clone(), IppPayload::new_async(file.compat()))
                .job_title(format!("print-agent-{job_id}"))
                .document_format("application/pdf")
                .attributes(self.attributes(options)?)
                .build()
                .map_err(Failure::internal)?;
        let response = self
            .client
            .send(operation)
            .await
            .map_err(|error| Failure::new("printer_unavailable", error.to_string()))?;
        if !response.header().status_code().is_success() {
            return Err(Failure::new(
                "cups_rejected",
                format!("CUPS rejected job: {}", response.header().status_code()),
            ));
        }
        response
            .attributes()
            .groups_of(DelimiterTag::JobAttributes)
            .find_map(|group| group.get("job-id"))
            .and_then(|attribute| match attribute.value() {
                IppValue::Integer(id) => Some(*id),
                _ => None,
            })
            .ok_or_else(|| Failure::new("cups_rejected", "CUPS response has no job-id"))
    }

    fn attributes(&self, options: &PrintOptions) -> Result<Vec<IppAttribute>, Failure> {
        let sides = match options.duplex {
            Duplex::None => "one-sided",
            Duplex::LongEdge => "two-sided-long-edge",
            Duplex::ShortEdge => "two-sided-short-edge",
        };
        let color = if options.color { "color" } else { "monochrome" };
        let orientation = match options.orientation {
            Orientation::Portrait => 3,
            Orientation::Landscape => 4,
        };
        let mut attributes = vec![
            attribute("copies", IppValue::Integer(i32::from(options.copies)))?,
            attribute("sides", keyword(sides)?)?,
            attribute("print-color-mode", keyword(color)?)?,
            attribute("media", keyword(&options.media)?)?,
            attribute("orientation-requested", IppValue::Enum(orientation))?,
        ];
        if !options.page_ranges.is_empty() {
            let ranges = options
                .page_ranges
                .split(',')
                .map(|part| {
                    let mut bounds = part.split('-');
                    let first = bounds.next().unwrap_or_default().parse::<i32>();
                    let last = bounds.next().map(str::parse::<i32>).transpose();
                    match (first, last) {
                        (Ok(first), Ok(last)) => {
                            Ok(IppValue::new_range_of_integer(first, last.unwrap_or(first)))
                        }
                        _ => Err(Failure::new("invalid_document", "invalid page range")),
                    }
                })
                .collect::<Result<Vec<_>, _>>()?;
            attributes.push(attribute("page-ranges", IppValue::Array(ranges))?);
        }
        Ok(attributes)
    }
}

fn keyword(value: &str) -> Result<IppValue, Failure> {
    IppValue::new_keyword(value)
        .map_err(|error| Failure::new("invalid_document", error.to_string()))
}

fn attribute(name: &str, value: IppValue) -> Result<IppAttribute, Failure> {
    let name =
        IppName::new(name).map_err(Failure::internal)?;
    Ok(IppAttribute::new(name, value))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_print_options_to_ipp_job_attributes() {
        let cups = Cups::new("http://127.0.0.1:631/printers/test").unwrap();
        let options = PrintOptions {
            copies: 2,
            duplex: Duplex::LongEdge,
            color: false,
            media: "Letter".to_owned(),
            page_ranges: "1-3,5".to_owned(),
            orientation: Orientation::Portrait,
        };
        let attributes = cups.attributes(&options).unwrap();
        let names = attributes
            .iter()
            .map(|attribute| attribute.name().as_str())
            .collect::<Vec<_>>();
        assert_eq!(
            names,
            [
                "copies",
                "sides",
                "print-color-mode",
                "media",
                "orientation-requested",
                "page-ranges",
            ],
        );
    }
}
