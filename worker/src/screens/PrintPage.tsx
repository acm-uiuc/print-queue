import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Center,
  Container,
  Divider,
  FileButton,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconFileTypePdf, IconPrinter, IconUpload } from "@tabler/icons-react";
import { PDFDocument } from "pdf-lib";
import { AcmAppShell } from "@/components/AppShell";
import { validatePageRange } from "@/print/pageRange";
import { uploadDocument } from "@/utils/api";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function PrintPage() {
  const selectionVersion = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [validatingFile, setValidatingFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState(false);
  const [doubleSided, setDoubleSided] = useState(false);
  const [flipOnLongSide, setFlipOnLongSide] = useState(true);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "portrait",
  );
  const [media, setMedia] = useState<"Letter" | "A4">("Letter");
  const [pageRange, setPageRange] = useState("");

  const pageRangeValidation = useMemo(
    () => (pageCount > 0 ? validatePageRange(pageRange, pageCount) : null),
    [pageCount, pageRange],
  );
  const copiesValid = Number.isInteger(copies) && copies >= 1 && copies <= 10;

  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    const requestVersion = selectionVersion.current + 1;
    selectionVersion.current = requestVersion;
    setError(null);
    setFile(null);
    setPageCount(0);
    setValidatingFile(false);

    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Invalid file type. Please upload a PDF.");
      return;
    }
    if (
      selectedFile.type &&
      selectedFile.type !== "application/pdf" &&
      selectedFile.type !== "application/x-pdf"
    ) {
      setError("Invalid file type. Please upload a PDF.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(
        `File size exceeds 20 MB. Current size: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB.`,
      );
      return;
    }

    setValidatingFile(true);
    try {
      const bytes = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      const selectedPageCount = pdf.getPageCount();
      if (selectedPageCount === 0) {
        throw new Error("PDF has no pages");
      }
      if (selectionVersion.current !== requestVersion) return;
      setFile(selectedFile);
      setPageCount(selectedPageCount);
    } catch {
      if (selectionVersion.current === requestVersion) {
        setError("This PDF is damaged, encrypted, or otherwise unreadable.");
      }
    } finally {
      if (selectionVersion.current === requestVersion) {
        setValidatingFile(false);
      }
    }
  };

  const removeFile = () => {
    selectionVersion.current += 1;
    setFile(null);
    setPageCount(0);
    setPageRange("");
    setError(null);
    setValidatingFile(false);
  };

  const handlePrint = async () => {
    if (!copiesValid) {
      setError("Copies must be a whole number from 1 to 10.");
      return;
    }
    if (!file || pageCount === 0) {
      setError("Please select a valid PDF to print.");
      return;
    }
    const validatedRange = validatePageRange(pageRange, pageCount);
    if (validatedRange.error) {
      setError(validatedRange.error);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("copies", copies.toString());
      formData.append("color", color.toString());
      formData.append("doubleSided", doubleSided.toString());
      formData.append("flipOnLongSide", flipOnLongSide.toString());
      formData.append("orientation", orientation);
      formData.append("media", media);
      if (validatedRange.normalized) {
        formData.append("pageRange", validatedRange.normalized);
      }

      const response = await uploadDocument(formData);
      setSubmittedJobId(response.jobId);
      removeFile();
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload document. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };


  return (
    <AcmAppShell>
      <Container fluid>
        <Title mb="lg">Print</Title>
        <SimpleGrid
          cols={{ base: 1, md: 2 }}
          spacing="xl"
          style={{ alignItems: "start" }}
        >
          <Paper radius="md" p="xl" withBorder>
            <Stack gap="md">
              <Title order={4}>Upload Document</Title>
              <Divider />

              {!file ? (
                <FileButton
                  onChange={(selectedFile) =>
                    void handleFileSelect(selectedFile)
                  }
                  accept="application/pdf,.pdf"
                >
                  {(buttonProps) => (
                    <Button
                      {...buttonProps}
                      leftSection={<IconUpload size={16} />}
                      variant="light"
                      fullWidth
                      loading={validatingFile}
                    >
                      Choose PDF
                    </Button>
                  )}
                </FileButton>
              ) : (
                <Stack gap="sm">
                  <Center>
                    <IconFileTypePdf size={48} />
                  </Center>
                  <Text ta="center" fw={500}>
                    {file.name}
                  </Text>
                  <Text ta="center" size="sm" c="dimmed">
                    {pageCount} page{pageCount === 1 ? "" : "s"} ·{" "}
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                  <Button
                    variant="light"
                    color="red"
                    onClick={removeFile}
                    fullWidth
                  >
                    Remove File
                  </Button>
                </Stack>
              )}

              {error ? <Alert color="red">{error}</Alert> : null}
              {submittedJobId ? (
                <Alert
                  color="green"
                  title="Print job accepted"
                  withCloseButton
                  onClose={() => setSubmittedJobId(null)}
                >
                  Job {submittedJobId} is queued for delivery to the printer.
                </Alert>
              ) : null}
            </Stack>
          </Paper>

          <Paper radius="md" p="xl" withBorder>
            <Stack gap="md">
              <Title order={4}>Print Settings</Title>
              <Divider />
              <NumberInput
                label="Copies"
                value={copies}
                onChange={(value) => {
                  if (typeof value === "number") setCopies(value);
                }}
                min={1}
                max={10}
                clampBehavior="strict"
                allowDecimal={false}
                error={
                  copiesValid ? undefined : "Enter a whole number from 1 to 10"
                }
              />
              <Switch
                label="Color"
                checked={color}
                onChange={(event) => setColor(event.currentTarget.checked)}
              />
              <Switch
                label="Double Sided"
                checked={doubleSided}
                onChange={(event) =>
                  setDoubleSided(event.currentTarget.checked)
                }
              />
              {doubleSided ? (
                <Select
                  label="Flip On"
                  value={flipOnLongSide ? "long" : "short"}
                  onChange={(value) => {
                    if (value) setFlipOnLongSide(value === "long");
                  }}
                  allowDeselect={false}
                  data={[
                    { value: "long", label: "Long Side" },
                    { value: "short", label: "Short Side" },
                  ]}
                />
              ) : null}
              <Select
                label="Orientation"
                value={orientation}
                onChange={(value) => {
                  if (value === "portrait" || value === "landscape") {
                    setOrientation(value);
                  }
                }}
                allowDeselect={false}
                data={[
                  { value: "portrait", label: "Portrait" },
                  { value: "landscape", label: "Landscape" },
                ]}
              />
              <Select
                label="Paper Size"
                value={media}
                onChange={(value) => {
                  if (value === "Letter" || value === "A4") setMedia(value);
                }}
                allowDeselect={false}
                data={["Letter", "A4"]}
              />
              <TextInput
                label="Page Range (optional)"
                placeholder="e.g., 1-5,8,11-13"
                value={pageRange}
                onChange={(event) => setPageRange(event.currentTarget.value)}
                description="Leave empty to print all pages"
                disabled={!file}
                error={pageRangeValidation?.error}
              />
              <Divider mt="md" />
              <Button
                onClick={() => void handlePrint()}
                disabled={
                  !file ||
                  !copiesValid ||
                  validatingFile ||
                  Boolean(pageRangeValidation?.error)
                }
                loading={uploading}
                leftSection={<IconPrinter size={16} />}
                fullWidth
              >
                Print
              </Button>
            </Stack>
          </Paper>
        </SimpleGrid>
      </Container>
    </AcmAppShell>
  );
}
