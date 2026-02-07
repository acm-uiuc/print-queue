import { useState } from 'react';
import {
  Box,
  Paper,
  Title,
  Button,
  Group,
  Select,
  NumberInput,
  Switch,
  Text,
  FileButton,
  Stack,
  Alert,
  Center,
  Loader,
  TextInput,
  Divider,
} from '@mantine/core';
import { IconUpload, IconPrinter, IconFileTypePdf, IconFileTypeDoc } from '@tabler/icons-react';
import { HeaderNavbar } from '@/components/Navbar';
import { useNavigate } from 'react-router-dom';
import { uploadDocument } from '@/utils/api';
import { usePrintJobs } from '@/print/usePrintJobs';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export function PrintPage() {
  const navigate = useNavigate();
  const { addJob } = usePrintJobs();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Print settings
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState(false);
  const [doubleSided, setDoubleSided] = useState(false);
  const [flipOnLongSide, setFlipOnLongSide] = useState(true);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pageRange, setPageRange] = useState('');

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;

    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload a PDF, DOCX, or DOC file.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File size exceeds 20 MB limit. Current size: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`);
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handlePrint = async () => {
    if (!file) {
      setError('Please select a file to print');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('copies', copies.toString());
      formData.append('color', color.toString());
      formData.append('doubleSided', doubleSided.toString());
      formData.append('flipOnLongSide', flipOnLongSide.toString());
      formData.append('orientation', orientation);
      if (pageRange) {
        formData.append('pageRange', pageRange);
      }

      const response = await uploadDocument(formData);
      
      if (response.jobId) {
        navigate(`/queue?jobId=${response.jobId}`);
      } else {
        navigate('/queue');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload document. Please try again.';
      setError(message);
      setUploading(false);
    }
  };

  const handleTestRun = () => {
    setError(null);
    const now = new Date();
    const jobId = `DEMO-${now.getTime()}`;
    const sizeMb = file ? Number((file.size / (1024 * 1024)).toFixed(2)) : 0.5;
    const pages = (() => {
      if (pageRange.trim().length === 0) {
        return Math.max(1, copies);
      }
      const computed = pageRange.split(',').reduce((acc, part) => {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map((v) => Number(v));
          if (!Number.isNaN(start) && !Number.isNaN(end)) {
            return acc + Math.max(0, end - start + 1);
          }
        }
        const num = Number(trimmed);
        if (!Number.isNaN(num)) {
          return acc + 1;
        }
        return acc;
      }, 0);
      return computed > 0 ? computed : Math.max(1, copies);
    })();

    addJob({
      id: jobId,
      submittedAt: now.toISOString(),
      fileName: file?.name ?? 'Demo Print.pdf',
      pages,
      sizeMb,
      durationSec: 5,
      status: 'Done',
    });
    navigate('/queue/demo');
  };

  const getFileIcon = () => {
    if (!file) return null;
    if (file.type === 'application/pdf') return <IconFileTypePdf size={48} />;
    return <IconFileTypeDoc size={48} />;
  };

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#f6f8fc',
      }}
    >
      <HeaderNavbar />
      <Box
        component="main"
        style={{
          flex: 1,
          padding: '2rem',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
        }}
      >


        <Group align="flex-start" gap="xl">
          {}
          <Paper radius="md" p="xl" withBorder style={{ flex: 1, minWidth: '300px' }}>
            <Stack gap="md">
              <Title order={4}>Upload Document</Title>
              <Divider />
              
              {!file ? (
                <FileButton onChange={handleFileSelect} accept=".pdf,.doc,.docx">
                  {(props) => (
                    <Button
                      {...props}
                      leftSection={<IconUpload size={16} />}
                      variant="light"
                      fullWidth
                      size="lg"
                    >
                      Choose File
                    </Button>
                  )}
                </FileButton>
              ) : (
                <Stack gap="sm">
                  <Center>
                    {getFileIcon()}
                  </Center>
                  <Text ta="center" fw={500}>{file.name}</Text>
                  <Text ta="center" size="sm" c="dimmed">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                  <Button
                    variant="light"
                    color="red"
                    onClick={() => setFile(null)}
                    fullWidth
                  >
                    Remove File
                  </Button>
                </Stack>
              )}

              {error && (
                <Alert color="red" mt="md">
                  {error}
                </Alert>
              )}

            </Stack>
          </Paper>

          {}
          <Paper radius="md" p="xl" withBorder style={{ flex: 1, minWidth: '300px' }}>
            <Stack gap="md">
              <Title order={4}>Print Settings</Title>
              <Divider />

              <NumberInput
                label="Copies"
                value={copies}
                onChange={(val) => setCopies(Number(val) || 1)}
                min={1}
                max={10}
              />

              <Switch
                label="Color"
                checked={color}
                onChange={(e) => setColor(e.currentTarget.checked)}
              />

              <Switch
                label="Double Sided"
                checked={doubleSided}
                onChange={(e) => setDoubleSided(e.currentTarget.checked)}
              />

              {doubleSided && (
                <Select
                  label="Flip On"
                  value={flipOnLongSide ? 'long' : 'short'}
                  onChange={(val) => setFlipOnLongSide(val === 'long')}
                  data={[
                    { value: 'long', label: 'Long Side' },
                    { value: 'short', label: 'Short Side' },
                  ]}
                />
              )}

              <Select
                label="Orientation"
                value={orientation}
                onChange={(val) => setOrientation(val as 'portrait' | 'landscape')}
                data={[
                  { value: 'portrait', label: 'Portrait' },
                  { value: 'landscape', label: 'Landscape' },
                ]}
              />

              <TextInput
                label="Page Range (optional)"
                placeholder="e.g., 1-5, 8, 11-13"
                value={pageRange}
                onChange={(e) => setPageRange(e.currentTarget.value)}
                description="Leave empty to print all pages"
              />

              <Divider mt="md" />

              <Stack gap="xs" style={{ marginTop: 'auto' }}>
                <Button
                  onClick={handlePrint}
                  disabled={!file || uploading}
                  leftSection={uploading ? <Loader size={16} /> : <IconPrinter size={16} />}
                  fullWidth
                  size="lg"
                  color="acmBlue"
                >
                  {uploading ? 'Uploading...' : 'Print'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestRun}
                  disabled={uploading}
                  fullWidth
                  color="acmBlue"
                >
                  Test
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Group>
      </Box>
    </Box>
  );
}
