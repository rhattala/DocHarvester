import { useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  TextField,
} from '@mui/material'
import {
  ArrowBack,
  Refresh,
  Upload,
  AutoAwesome,
  MoreVert,
  Description,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  CloudUpload,
  Folder,
  GitHub,
  Storage,
  CloudQueue,
  PlayArrow,
  Article,
  Assessment,
} from '@mui/icons-material'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { api, Document } from '../services/api'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

const LENS_COLORS = {
  LOGIC: '#4F46E5',
  SOP: '#10B981',
  GTM: '#F59E0B',
  CL: '#EF4444',
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  
  const projectId = parseInt(id!, 10)
  const currentTab = searchParams.get('tab') || 'overview'
  const tabIndex = Math.max(0, ['overview', 'documents', 'coverage', 'upload', 'connectors', 'wiki', 'knowledge-graph'].indexOf(currentTab))
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [localFolderPath, setLocalFolderPath] = useState('')

  // Queries
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
    enabled: !!projectId,
  })

  const { data: stats } = useQuery({
    queryKey: ['project-stats', projectId],
    queryFn: () => api.getProjectStats(projectId),
    enabled: !!projectId && tabIndex === 0,
  })

  const { data: coverage } = useQuery({
    queryKey: ['project-coverage', projectId],
    queryFn: () => api.getCoverageStatus(projectId),
    enabled: !!projectId && tabIndex === 2,
  })

  const { data: documents } = useQuery({
    queryKey: ['project-documents', projectId],
    queryFn: () => api.searchDocuments({ project_id: projectId, limit: 50 }),
    enabled: !!projectId && tabIndex === 1,
  })

  const { data: connectorConfigs } = useQuery({
    queryKey: ['project-connectors', projectId],
    queryFn: () => api.getProjectConnectors(projectId),
    enabled: !!projectId && tabIndex === 4,
  })

  const { data: ingestionStatus } = useQuery({
    queryKey: ['ingestion-status', projectId],
    queryFn: () => api.getIngestionStatus(projectId),
    enabled: !!projectId && (tabIndex === 3 || tabIndex === 0), // Upload tab or Overview tab
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  // Knowledge graph data
  const { data: knowledgeGraphStats } = useQuery({
    queryKey: ['knowledge-graph-stats', projectId],
    queryFn: () => api.getKnowledgeGraphStats(projectId),
    enabled: !!projectId && tabIndex === 6, // Knowledge Graph tab
  })

  const { data: entities } = useQuery({
    queryKey: ['project-entities', projectId],
    queryFn: () => api.searchEntities(projectId),
    enabled: !!projectId && tabIndex === 6,
  })

  // Mutations
  const ingestionMutation = useMutation({
    mutationFn: () => api.startIngestion(projectId),
    onSuccess: () => {
      toast.success('Ingestion started successfully')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: () => toast.error('Failed to start ingestion'),
  })

  const coverageCheckMutation = useMutation({
    mutationFn: () => api.triggerCoverageCheck(projectId),
    onSuccess: () => {
      toast.success('Coverage check started')
      queryClient.invalidateQueries({ queryKey: ['project-coverage', projectId] })
    },
    onError: () => toast.error('Failed to start coverage check'),
  })

  const generateDocsMutation = useMutation({
    mutationFn: (lens_types?: string[]) => api.generateMissingDocs(projectId, lens_types),
    onSuccess: () => {
      toast.success('Documentation generation started')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: () => toast.error('Failed to start documentation generation'),
  })

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.uploadDocuments(projectId, files),
    onSuccess: () => {
      toast.success('Files uploaded successfully')
      setUploadedFiles([])
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] })
      queryClient.invalidateQueries({ queryKey: ['ingestion-status', projectId] })
    },
    onError: () => toast.error('Failed to upload files'),
  })

  const configureConnectorMutation = useMutation({
    mutationFn: (data: { connector_type: string; config: any }) => 
      api.updateConnectorConfig(projectId, data.connector_type, data.config),
    onSuccess: () => {
      toast.success('Connector configured successfully')
      setLocalFolderPath('')
      queryClient.invalidateQueries({ queryKey: ['project-connectors', projectId] })
    },
    onError: () => toast.error('Failed to configure connector'),
  })

  // File upload handling
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles(prev => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/*': ['.txt', '.md', '.rst'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
  })

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const tabs = ['overview', 'documents', 'coverage', 'upload', 'connectors', 'wiki', 'knowledge-graph']
    setSearchParams({ tab: tabs[newValue] })
  }

  const handleUpload = () => {
    if (uploadedFiles.length > 0) {
      uploadMutation.mutate(uploadedFiles)
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  if (projectLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (!project) {
    return <Alert severity="error">Project not found</Alert>
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/projects')}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h4">{project.name}</Typography>
            <Typography variant="body2" color="textSecondary">
              {project.description || 'No description'}
            </Typography>
          </Box>
        </Box>
        <Box>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreVert />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem onClick={() => ingestionMutation.mutate()}>
              Start Ingestion
            </MenuItem>
            <MenuItem onClick={() => coverageCheckMutation.mutate()}>
              Check Coverage
            </MenuItem>
            <MenuItem onClick={() => generateDocsMutation.mutate(undefined)}>
              Generate Missing Docs
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabIndex} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Documents" />
          <Tab label="Coverage" />
          <Tab label="Upload" />
          <Tab label="Connectors" />
          <Tab label="Wiki" />
          <Tab label="Knowledge Graph" />
        </Tabs>
      </Paper>

      {/* Overview Tab */}
      <TabPanel value={tabIndex} index={0}>
        {stats && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Documents
                  </Typography>
                  <Typography variant="h4">{stats.total_documents}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Chunks
                  </Typography>
                  <Typography variant="h4">{stats.total_chunks}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Coverage
                  </Typography>
                  <Typography variant="h4">
                    {Math.round(project.coverage_percentage)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Last Updated
                  </Typography>
                  <Typography variant="body1">
                    {new Date(project.updated_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Wiki Access Card */}
            <Grid item xs={12}>
              <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h6" sx={{ color: 'white' }}>
                        Project Wiki
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        View the AI-generated documentation wiki for this project
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      sx={{ 
                        bgcolor: 'white', 
                        color: 'primary.main',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
                      }}
                      onClick={() => navigate(`/projects/${projectId}/wiki`)}
                      startIcon={<AutoAwesome />}
                    >
                      Open Wiki
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Documents by Type */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Documents by Type
                </Typography>
                {Object.entries(stats.documents_by_type).map(([type, count]) => (
                  <Box key={type} display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" sx={{ minWidth: 100 }}>
                      {type || 'Unknown'}
                    </Typography>
                    <Box flexGrow={1} mx={2}>
                      <LinearProgress
                        variant="determinate"
                        value={(count / stats.total_documents) * 100}
                      />
                    </Box>
                    <Typography variant="body2">{count}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>

            {/* Coverage by Lens */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Coverage by Lens
                </Typography>
                {Object.entries(stats.coverage_by_lens).map(([lens, count]) => (
                  <Box key={lens} display="flex" alignItems="center" mb={1}>
                    <Chip
                      label={lens}
                      size="small"
                      sx={{
                        bgcolor: LENS_COLORS[lens as keyof typeof LENS_COLORS],
                        color: 'white',
                        minWidth: 60,
                      }}
                    />
                    <Typography variant="body2" sx={{ ml: 2 }}>
                      {count} chunks
                    </Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>

            {/* Recent Activity */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                <List>
                  {stats.recent_activity.map((activity, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={`${activity.action}: ${activity.document}`}
                        secondary={new Date(activity.time).toLocaleString()}
                      />
                      <Chip label={activity.type} size="small" />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Documents Tab */}
      <TabPanel value={tabIndex} index={1}>
        {documents && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Documents ({documents.total})
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] })}
              >
                Refresh
              </Button>
            </Box>
            <List>
              {documents.documents.map((doc: Document) => (
                <Box key={doc.id}>
                  <ListItem>
                    <Description sx={{ mr: 2, color: 'text.secondary' }} />
                    <ListItemText
                      primary={doc.title}
                      secondary={
                        <Box>
                          <Typography variant="caption" component="span">
                            {doc.source_type} • {doc.file_type} • {doc.chunk_count} chunks
                          </Typography>
                          <br />
                          <Typography variant="caption" component="span">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end">
                        <MoreVert />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                </Box>
              ))}
            </List>
          </Box>
        )}
      </TabPanel>

      {/* Coverage Tab */}
      <TabPanel value={tabIndex} index={2}>
        {coverage && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="h6">
                  Overall Coverage: {Math.round(coverage.overall_coverage)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={coverage.overall_coverage}
                  sx={{ width: 300, mt: 1 }}
                />
              </Box>
              <Box>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => coverageCheckMutation.mutate()}
                  disabled={coverageCheckMutation.isPending}
                  sx={{ mr: 1 }}
                >
                  Check Coverage
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AutoAwesome />}
                  onClick={() => generateDocsMutation.mutate(undefined)}
                  disabled={generateDocsMutation.isPending}
                >
                  Generate Missing
                </Button>
              </Box>
            </Box>

            {/* Coverage Status by Lens */}
            <Grid container spacing={2}>
              {coverage.status.map((status) => {
                const requirement = coverage.requirements.find(r => r.lens_type === status.lens_type)
                const icon = status.status === 'complete' ? <CheckCircle color="success" /> :
                           status.status === 'good' ? <CheckCircle color="primary" /> :
                           status.status === 'partial' ? <Warning color="warning" /> :
                           <ErrorIcon color="error" />
                
                return (
                  <Grid item xs={12} md={6} key={status.lens_type}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Chip
                              label={status.lens_type}
                              sx={{
                                bgcolor: LENS_COLORS[status.lens_type as keyof typeof LENS_COLORS],
                                color: 'white',
                              }}
                            />
                            {icon}
                          </Box>
                          <Typography variant="h6">
                            {Math.round(status.coverage_percentage)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={status.coverage_percentage}
                          sx={{ mb: 2 }}
                        />
                        <Typography variant="body2" color="textSecondary">
                          {status.document_count} documents • {status.chunk_count} chunks
                        </Typography>
                        {requirement && (
                          <Typography variant="body2" color="textSecondary">
                            Required: {requirement.min_documents} documents
                          </Typography>
                        )}
                        {status.missing_topics.length > 0 && (
                          <Box mt={1}>
                            <Typography variant="caption" color="textSecondary">
                              Missing topics: {status.missing_topics.slice(0, 3).join(', ')}
                              {status.missing_topics.length > 3 && '...'}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>

            {/* Recommendations */}
            {coverage.recommendations.length > 0 && (
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>
                  Recommendations
                </Typography>
                <List>
                  {coverage.recommendations.map((rec, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={rec.message}
                        secondary={
                          rec.suggested_topics.length > 0 &&
                          `Suggested topics: ${rec.suggested_topics.join(', ')}`
                        }
                      />
                      <Chip
                        label={rec.priority}
                        size="small"
                        color={
                          rec.priority === 'high' ? 'error' :
                          rec.priority === 'medium' ? 'warning' : 'default'
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </TabPanel>

      {/* Upload Tab */}
      <TabPanel value={tabIndex} index={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Upload Documents
          </Typography>
          
          {/* Ingestion Status */}
          {ingestionStatus && (
            <Alert 
              severity={ingestionStatus.status === 'completed' ? 'success' : 'info'} 
              sx={{ mb: 3 }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Processing Status: {ingestionStatus.status === 'completed' ? '✅ Ready' : '🔄 Processing'}
              </Typography>
              {ingestionStatus.recent_documents.length > 0 && (
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Recently processed documents:
                  </Typography>
                  {ingestionStatus.recent_documents.slice(0, 3).map((doc: any, index: number) => (
                    <Chip 
                      key={index}
                      label={`${doc.title} (${doc.file_type})`}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              )}
              {ingestionStatus.last_activity && (
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Last activity: {new Date(ingestionStatus.last_activity).toLocaleString()}
                </Typography>
              )}
            </Alert>
          )}
          
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: isDragActive ? 'action.hover' : 'background.paper',
              mb: 3,
            }}
          >
            <input {...getInputProps()} />
            <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              or click to select files
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block" mt={1}>
              Supported formats: TXT, MD, RST, PDF, DOC, DOCX
            </Typography>
          </Box>

          {uploadedFiles.length > 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Selected Files ({uploadedFiles.length})
              </Typography>
              <List>
                {uploadedFiles.map((file, index) => (
                  <ListItem key={index}>
                    <Description sx={{ mr: 2 }} />
                    <ListItemText
                      primary={file.name}
                      secondary={`${(file.size / 1024).toFixed(2)} KB`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => removeFile(index)}>
                        <ErrorIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
              
              <Box mt={2}>
                <Button
                  variant="contained"
                  startIcon={<Upload />}
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  fullWidth
                >
                  {uploadMutation.isPending ? 'Uploading...' : `Upload ${uploadedFiles.length} Files`}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </TabPanel>

      {/* Connectors Tab */}
      <TabPanel value={tabIndex} index={4}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Configure Connectors
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Connect external sources to automatically discover and ingest documents.
          </Typography>

          {/* Current Configurations */}
          {connectorConfigs?.connectors && Object.keys(connectorConfigs.connectors).length > 0 && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Currently Configured Connectors:
              </Typography>
              {Object.entries(connectorConfigs.connectors).map(([type, config]: [string, any]) => (
                <Box key={type} sx={{ mt: 1 }}>
                  <Chip 
                    label={`${type}: ${config.folder_path || config.repo_url || JSON.stringify(config)}`}
                    color="success"
                    size="small"
                    onDelete={() => {
                      // TODO: Add delete connector functionality
                    }}
                  />
                </Box>
              ))}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Local Folder Connector */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <Folder color="primary" />
                    <Typography variant="h6">Local Folder</Typography>
                    {connectorConfigs?.connectors?.local_folder && (
                      <Chip label="Configured" color="success" size="small" />
                    )}
                  </Box>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Monitor a local folder for documents
                  </Typography>
                  {connectorConfigs?.connectors?.local_folder && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Current path:</strong> {connectorConfigs.connectors.local_folder.folder_path}
                      </Typography>
                    </Alert>
                  )}
                  <TextField
                    fullWidth
                    label="Folder Path"
                    placeholder="/path/to/documents"
                    variant="outlined"
                    size="small"
                    value={localFolderPath}
                    onChange={(e) => setLocalFolderPath(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Button 
                    variant="contained" 
                    size="small" 
                    fullWidth
                    disabled={!localFolderPath || configureConnectorMutation.isPending}
                    onClick={() => {
                      configureConnectorMutation.mutate({
                        connector_type: 'local_folder',
                        config: { folder_path: localFolderPath }
                      })
                    }}
                  >
                    {configureConnectorMutation.isPending ? 'Configuring...' : connectorConfigs?.connectors?.local_folder ? 'Update Configuration' : 'Configure'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* GitHub Connector */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <GitHub />
                    <Typography variant="h6">GitHub</Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Connect to a GitHub repository
                  </Typography>
                  <TextField
                    fullWidth
                    label="Repository URL"
                    placeholder="https://github.com/user/repo"
                    variant="outlined"
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    label="Branch"
                    placeholder="main"
                    variant="outlined"
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <Button variant="contained" size="small" fullWidth disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Confluence Connector */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <Storage />
                    <Typography variant="h6">Confluence</Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Import documentation from Confluence
                  </Typography>
                  <TextField
                    fullWidth
                    label="Space Key"
                    placeholder="DOCS"
                    variant="outlined"
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <Button variant="contained" size="small" fullWidth disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Google Drive Connector */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <CloudQueue />
                    <Typography variant="h6">Google Drive</Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Connect to Google Drive folders
                  </Typography>
                  <TextField
                    fullWidth
                    label="Folder ID"
                    placeholder="Enter folder ID"
                    variant="outlined"
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <Button variant="contained" size="small" fullWidth disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Start Ingestion Button */}
          <Box mt={4} display="flex" justifyContent="center">
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={() => ingestionMutation.mutate()}
              disabled={ingestionMutation.isPending}
            >
              Start Document Discovery & Ingestion
            </Button>
          </Box>
        </Box>
      </TabPanel>

      {/* Wiki Tab */}
      <TabPanel value={tabIndex} index={5}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="400px">
          <Article sx={{ fontSize: 80, color: 'text.secondary', mb: 3 }} />
          <Typography variant="h5" gutterBottom>
            Project Wiki
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" maxWidth={500} mb={3}>
            View and explore the AI-generated documentation wiki for this project
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<AutoAwesome />}
            onClick={() => navigate(`/projects/${projectId}/wiki`)}
          >
            Open Wiki
          </Button>
        </Box>
      </TabPanel>

      {/* Knowledge Graph Tab */}
      <TabPanel value={tabIndex} index={6}>
        <Box>
          {/* Knowledge Graph Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Knowledge Graph
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Explore entities and relationships extracted from documents
              </Typography>
            </Box>
            <Box>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => {
                  api.extractEntitiesForProject(projectId)
                  toast.success('Entity extraction started')
                  queryClient.invalidateQueries({ queryKey: ['knowledge-graph-stats', projectId] })
                }}
                sx={{ mr: 1 }}
              >
                Extract Entities
              </Button>
              <Button
                variant="contained"
                startIcon={<AutoAwesome />}
                onClick={() => {
                  api.refreshKnowledgeGraph(projectId)
                  toast.success('Knowledge graph refresh started')
                  queryClient.invalidateQueries({ queryKey: ['knowledge-graph-stats', projectId] })
                }}
              >
                Refresh Graph
              </Button>
            </Box>
          </Box>

          {/* Knowledge Graph Stats */}
          {knowledgeGraphStats && (
            <Grid container spacing={3} mb={3}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Entities
                    </Typography>
                    <Typography variant="h4">{knowledgeGraphStats.total_entities}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Relationships
                    </Typography>
                    <Typography variant="h4">{knowledgeGraphStats.total_relationships}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Entity Types
                    </Typography>
                    <Typography variant="h4">{Object.keys(knowledgeGraphStats.entities_by_type || {}).length}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Last Updated
                    </Typography>
                    <Typography variant="body1">
                      {knowledgeGraphStats.last_updated 
                        ? new Date(knowledgeGraphStats.last_updated).toLocaleDateString()
                        : 'Never'
                      }
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Entities List */}
          {entities && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Extracted Entities ({entities.total_found})
              </Typography>
              
              {entities.entities.length > 0 ? (
                <Grid container spacing={2}>
                  {entities.entities.map((entity: any, index: number) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Card>
                        <CardContent>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Chip
                              label={entity.type}
                              size="small"
                              sx={{
                                bgcolor: LENS_COLORS[entity.lens_type as keyof typeof LENS_COLORS] || '#666',
                                color: 'white',
                              }}
                            />
                            <Typography variant="h6" component="span">
                              {entity.name}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="textSecondary" mb={1}>
                            From: {entity.source_document}
                          </Typography>
                          {Object.keys(entity.properties).length > 0 && (
                            <Box>
                              <Typography variant="caption" display="block" gutterBottom>
                                Properties:
                              </Typography>
                              {Object.entries(entity.properties).map(([key, value]) => (
                                <Typography key={key} variant="caption" display="block">
                                  {key}: {String(value)}
                                </Typography>
                              ))}
                            </Box>
                          )}
                          <LinearProgress
                            variant="determinate"
                            value={entity.confidence * 100}
                            sx={{ mt: 1 }}
                          />
                          <Typography variant="caption" color="textSecondary">
                            Confidence: {Math.round(entity.confidence * 100)}%
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    No entities extracted yet
                  </Typography>
                  <Typography variant="body2" color="textSecondary" mb={2}>
                    Run entity extraction to discover entities in your documents
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AutoAwesome />}
                    onClick={() => {
                      api.extractEntitiesForProject(projectId)
                      toast.success('Entity extraction started')
                    }}
                  >
                    Extract Entities Now
                  </Button>
                </Paper>
              )}
            </Box>
          )}
        </Box>
      </TabPanel>
    </Box>
  )
} 