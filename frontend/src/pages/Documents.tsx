import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Pagination,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  IconButton,
  Menu,
  Divider,
} from '@mui/material'
import {
  Search,
  Description,
  MoreVert,
  AutoAwesome,
} from '@mui/icons-material'
import { api, Document } from '../services/api'
import DocumentViewer from '../components/DocumentViewer'

const LENS_COLORS = {
  LOGIC: '#4F46E5',
  SOP: '#10B981',
  GTM: '#F59E0B',
  CL: '#EF4444',
}

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<number | undefined>()
  const [selectedLens, setSelectedLens] = useState<string>('')
  const [selectedFileType, setSelectedFileType] = useState<string>('')
  const [showGenerated, setShowGenerated] = useState<boolean | undefined>()
  const [page, setPage] = useState(1)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [viewerDocumentId, setViewerDocumentId] = useState<number | null>(null)
  const [selectedDocumentForMenu, setSelectedDocumentForMenu] = useState<Document | null>(null)

  // Fetch projects for filter
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  })

  // Fetch documents with filters
  const { data: documentsData, isLoading, error } = useQuery({
    queryKey: ['documents', searchQuery, selectedProject, selectedLens, selectedFileType, showGenerated, page],
    queryFn: () => api.searchDocuments({
      q: searchQuery || undefined,
      project_id: selectedProject,
      lens_type: selectedLens || undefined,
      file_type: selectedFileType || undefined,
      is_generated: showGenerated,
      page,
      limit: 20,
    }),
  })

  // Fetch lens statistics
  const { data: lensStats } = useQuery({
    queryKey: ['lens-stats'],
    queryFn: () => api.getLensStatistics(),
  })

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    setPage(1)
  }

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value)
  }

  const handleDocumentClick = (doc: Document) => {
    setViewerDocumentId(doc.id)
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, doc: Document) => {
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
    setSelectedDocumentForMenu(doc)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedDocumentForMenu(null)
  }

  const handleViewDocument = () => {
    if (selectedDocumentForMenu) {
      setViewerDocumentId(selectedDocumentForMenu.id)
    }
    handleMenuClose()
  }

  const handleDownloadDocument = () => {
    if (selectedDocumentForMenu) {
      // Trigger download - this could be enhanced to get actual file content
      window.open(`/api/v1/documents/${selectedDocumentForMenu.id}/content`, '_blank')
    }
    handleMenuClose()
  }

  const handleDeleteDocument = async () => {
    if (selectedDocumentForMenu) {
      try {
        await api.deleteDocument(selectedDocumentForMenu.id)
        // Refresh the documents list
        // The useQuery will automatically refetch
      } catch (error) {
        console.error('Failed to delete document:', error)
      }
    }
    handleMenuClose()
  }

  const handleReclassifyDocument = async () => {
    if (selectedDocumentForMenu) {
      try {
        await api.reclassifyDocument(selectedDocumentForMenu.id)
        // Could show a toast notification here
      } catch (error) {
        console.error('Failed to reclassify document:', error)
      }
    }
    handleMenuClose()
  }

  if (isLoading && !documentsData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return <Alert severity="error">Failed to load documents</Alert>
  }

  const documents = documentsData?.documents || []
  const totalPages = documentsData?.pages || 1

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Documents
      </Typography>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search documents..."
              value={searchQuery}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Project</InputLabel>
              <Select
                value={selectedProject || ''}
                onChange={(e) => {
                  setSelectedProject(e.target.value ? Number(e.target.value) : undefined)
                  setPage(1)
                }}
                label="Project"
              >
                <MenuItem value="">All Projects</MenuItem>
                {projects?.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Lens Type</InputLabel>
              <Select
                value={selectedLens}
                onChange={(e) => {
                  setSelectedLens(e.target.value)
                  setPage(1)
                }}
                label="Lens Type"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="LOGIC">LOGIC</MenuItem>
                <MenuItem value="SOP">SOP</MenuItem>
                <MenuItem value="GTM">GTM</MenuItem>
                <MenuItem value="CL">CL</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>File Type</InputLabel>
              <Select
                value={selectedFileType}
                onChange={(e) => {
                  setSelectedFileType(e.target.value)
                  setPage(1)
                }}
                label="File Type"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="md">Markdown</MenuItem>
                <MenuItem value="txt">Text</MenuItem>
                <MenuItem value="pdf">PDF</MenuItem>
                <MenuItem value="docx">Word</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Source</InputLabel>
              <Select
                value={showGenerated === undefined ? '' : showGenerated ? 'generated' : 'human'}
                onChange={(e) => {
                  setShowGenerated(
                    e.target.value === '' ? undefined :
                    e.target.value === 'generated' ? true : false
                  )
                  setPage(1)
                }}
                label="Source"
              >
                <MenuItem value="">All Sources</MenuItem>
                <MenuItem value="human">Human Written</MenuItem>
                <MenuItem value="generated">AI Generated</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Statistics */}
      <Grid container spacing={2} mb={3}>
        {lensStats?.stats?.map((stat: any) => (
          <Grid item xs={6} md={3} key={stat.lens_type}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Chip
                      label={stat.lens_type}
                      size="small"
                      sx={{
                        bgcolor: LENS_COLORS[stat.lens_type as keyof typeof LENS_COLORS],
                        color: 'white',
                        mb: 1,
                      }}
                    />
                    <Typography variant="h6">{stat.document_count}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      documents
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="textSecondary">
                    {stat.chunk_count}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Documents List */}
      <Paper>
        <List>
          {documents.map((doc, index) => (
            <Box key={doc.id}>
              <ListItem
                button
                onClick={() => handleDocumentClick(doc)}
              >
                <ListItemIcon>
                  <Description />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body1">{doc.title}</Typography>
                      {doc.source_type === 'generated' && (
                        <Chip
                          icon={<AutoAwesome />}
                          label="AI Generated"
                          size="small"
                          color="secondary"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" component="span">
                        {doc.source_type} • {doc.file_type} • {doc.chunk_count} chunks
                      </Typography>
                      <br />
                      <Typography variant="caption" component="span">
                        Created: {new Date(doc.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />
                <IconButton
                  edge="end"
                  onClick={(e) => handleMenuClick(e, doc)}
                >
                  <MoreVert />
                </IconButton>
              </ListItem>
              {index < documents.length - 1 && <Divider />}
            </Box>
          ))}
        </List>

        {documents.length === 0 && (
          <Box p={4} textAlign="center">
            <Description sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary">
              No documents found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Try adjusting your search filters
            </Typography>
          </Box>
        )}

        {totalPages > 1 && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {/* Document Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDocument}>View Details</MenuItem>
        <MenuItem onClick={handleDownloadDocument}>Download</MenuItem>
        <MenuItem onClick={handleReclassifyDocument}>Reclassify</MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteDocument} sx={{ color: 'error.main' }}>
          Delete
        </MenuItem>
      </Menu>

      {viewerDocumentId && (
        <DocumentViewer
          documentId={viewerDocumentId}
          open={true}
          onClose={() => setViewerDocumentId(null)}
        />
      )}
    </Box>
  )
} 