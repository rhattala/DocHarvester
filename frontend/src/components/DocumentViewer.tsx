import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Paper,
} from '@mui/material'
import {
  Close,
  Download,
  AutoAwesome,
  Description,
  Visibility,
  Edit,
} from '@mui/icons-material'
import { api } from '../services/api'
import ReactMarkdown from 'react-markdown'

interface DocumentViewerProps {
  documentId: number | null
  open: boolean
  onClose: () => void
}

export default function DocumentViewer({ documentId, open, onClose }: DocumentViewerProps) {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted')

  // Fetch document content
  const { data: document, isLoading, error } = useQuery({
    queryKey: ['document-content', documentId],
    queryFn: () => documentId ? api.getDocumentContent(documentId) : Promise.resolve(null),
    enabled: !!documentId && open,
  })

  // Fetch document metadata
  const { data: docMeta } = useQuery({
    queryKey: ['document-meta', documentId],
    queryFn: () => documentId ? api.getDocument(documentId) : Promise.resolve(null),
    enabled: !!documentId && open,
  })

  const handleDownload = () => {
    if (!document) return

    const content = document.raw_text
    const filename = `${document.title || 'document'}.${document.file_type || 'txt'}`
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderContent = () => {
    if (!document) return null

    if (viewMode === 'raw') {
      return (
        <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: '500px', overflow: 'auto' }}>
          <Typography
            component="pre"
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {document.raw_text}
          </Typography>
        </Paper>
      )
    }

    // Formatted view
    if (document.file_type === 'md') {
      return (
        <Box sx={{ maxHeight: '500px', overflow: 'auto' }}>
          <ReactMarkdown>{document.raw_text}</ReactMarkdown>
        </Box>
      )
    }

    // Default text view with basic formatting
    return (
      <Box sx={{ maxHeight: '500px', overflow: 'auto' }}>
        <Typography
          variant="body1"
          sx={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
          }}
        >
          {document.raw_text}
        </Typography>
      </Box>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="between">
          <Box display="flex" alignItems="center" gap={2} flex={1}>
            <Description />
            <Box>
              <Typography variant="h6" component="div">
                {document?.title || 'Loading...'}
              </Typography>
              {docMeta && (
                <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                  <Chip
                    label={document?.file_type?.toUpperCase() || 'UNKNOWN'}
                    size="small"
                    variant="outlined"
                  />
                  {docMeta.source_meta?.is_generated && (
                    <Chip
                      icon={<AutoAwesome />}
                      label="AI Generated"
                      size="small"
                      color="secondary"
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {docMeta.chunk_count} chunks
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Toggle View Mode">
              <IconButton
                onClick={() => setViewMode(viewMode === 'formatted' ? 'raw' : 'formatted')}
                color={viewMode === 'formatted' ? 'primary' : 'default'}
              >
                {viewMode === 'formatted' ? <Visibility /> : <Edit />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton onClick={handleDownload} disabled={!document}>
                <Download />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {isLoading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
            <Typography ml={2}>Loading document...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error">
            Failed to load document content
          </Alert>
        )}

        {document && (
          <Box>
            {/* Document metadata */}
            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Document Information
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Typography variant="caption">
                  Created: {new Date(document.created_at).toLocaleString()}
                </Typography>
                {document.last_modified && (
                  <Typography variant="caption">
                    Modified: {new Date(document.last_modified).toLocaleString()}
                  </Typography>
                )}
                <Typography variant="caption">
                  Type: {document.file_type}
                </Typography>
                <Typography variant="caption">
                  Length: {document.raw_text?.length.toLocaleString()} characters
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Content */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Content ({viewMode === 'formatted' ? 'Formatted' : 'Raw'})
              </Typography>
              {renderContent()}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
} 