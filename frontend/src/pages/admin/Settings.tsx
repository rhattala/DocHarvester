import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Chip,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ButtonGroup,
} from '@mui/material'
import { 
  CheckCircle, 
  Warning, 
  Error as ErrorIcon, 
  SmartToy, 
  CloudQueue,
  Computer,
  ExpandMore,
  Speed,
  Memory,
  Language,
  Psychology,
  Refresh
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import axios from 'axios'

interface PlatformSettings {
  app_name: string
  debug_mode: boolean
  max_file_size_mb: number
  chunk_size: number
  chunk_overlap: number
  worker_batch_size: number
  worker_timeout_seconds: number
  llm_provider: string
  llm_model: string
  embedding_model: string
  llm_temperature: number
  llm_max_tokens: number
  use_local_llm: boolean
  current_llm_provider: string
  openai_api_key_configured: boolean
  openai_organization_id?: string
  local_llm_model: string
  available_openai_models: string[]
  available_local_models: string[]
}

interface LLMStatus {
  current_provider: string
  openai_configured: boolean
  ollama_configured: boolean
  openai_status: any
  ollama_status: any
  available_models: any
}

interface ModelInfo {
  context_window: number
  large_context: boolean
  recommended_for: string[]
  tier?: string
  cost_per_1k?: number
  memory_gb?: number | string
  provider?: string
}

interface ModelDetails {
  [model: string]: ModelInfo
}

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null)
  const [loadingLlmStatus, setLoadingLlmStatus] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [switchingProvider, setSwitchingProvider] = useState(false)
  const [modelDetails, setModelDetails] = useState<ModelDetails>({})

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm<PlatformSettings>()

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/v1/admin/settings')
      setSettings(response.data)
      reset(response.data)
    } catch (error) {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const fetchLlmStatus = async () => {
    try {
      setLoadingLlmStatus(true)
      const response = await axios.get('/api/v1/admin/llm/status')
      setLlmStatus(response.data)
    } catch (error) {
      console.error('Failed to load LLM status:', error)
      toast.error('Failed to load LLM status')
    } finally {
      setLoadingLlmStatus(false)
    }
  }

  const fetchModelDetails = async (provider?: string) => {
    try {
      const url = provider ? `/api/v1/admin/llm/models?provider=${provider}` : '/api/v1/admin/llm/models'
      const response = await axios.get(url)
      setModelDetails(response.data.model_info || {})
    } catch (error) {
      console.error('Failed to load model details:', error)
    }
  }

  const testLlmConnection = async () => {
    try {
      setTestingConnection(true)
      const response = await axios.post('/api/v1/admin/llm/test-connection')
      
      if (response.data.success) {
        toast.success(`${response.data.provider} connection test successful!`)
      } else {
        toast.error(`Connection test failed: ${response.data.error || 'Unknown error'}`)
      }
    } catch (error) {
      toast.error('Failed to test connection')
    } finally {
      setTestingConnection(false)
    }
  }

  const switchLlmProvider = async (provider: string) => {
    try {
      setSwitchingProvider(true)
      const response = await axios.post('/api/v1/admin/llm/switch-provider', {
        provider: provider
      })
      
      toast.success(response.data.message)
      await fetchLlmStatus()
      await fetchSettings()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to switch provider')
    } finally {
      setSwitchingProvider(false)
    }
  }

  const onSubmit = async (data: PlatformSettings) => {
    try {
      setSaving(true)
      await axios.put('/api/v1/admin/settings', data)
      toast.success('Settings updated successfully')
      fetchSettings()
    } catch (error) {
      toast.error('Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    fetchLlmStatus()
    fetchModelDetails()
  }, [])

  // Update model details when provider changes
  useEffect(() => {
    if (llmStatus?.current_provider) {
      fetchModelDetails(llmStatus.current_provider)
    }
  }, [llmStatus?.current_provider])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography ml={2}>Loading settings...</Typography>
      </Box>
    )
  }

  const getProviderStatusColor = (provider: string) => {
    if (!llmStatus) return 'default'
    
    if (provider === 'OPENAI') {
      return llmStatus.openai_status?.valid ? 'success' : 'error'
    } else {
      return llmStatus.ollama_status?.valid ? 'success' : 'error'
    }
  }

  const getProviderStatusIcon = (provider: string) => {
    if (!llmStatus) return <ErrorIcon />
    
    if (provider === 'OPENAI') {
      return llmStatus.openai_status?.valid ? <CheckCircle /> : <ErrorIcon />
    } else {
      return llmStatus.ollama_status?.valid ? <CheckCircle /> : <ErrorIcon />
    }
  }

  const renderModelRecommendations = (recommendations: string[]) => {
    const iconMap: { [key: string]: any } = {
      'fast': <Speed fontSize="small" />,
      'memory_efficient': <Memory fontSize="small" />,
      'large_document': <Language fontSize="small" />,
      'general': <Psychology fontSize="small" />,
      'cost_effective': <Speed fontSize="small" />,
      'high_quality': <CheckCircle fontSize="small" />
    }

    return recommendations.map((rec, index) => (
      <Chip
        key={index}
        label={rec.replace('_', ' ')}
        size="small"
        icon={iconMap[rec] || <CheckCircle fontSize="small" />}
        variant="outlined"
        sx={{ mr: 0.5, mb: 0.5 }}
      />
    ))
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Platform Settings
      </Typography>

      {/* LLM Status and Management Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <SmartToy sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h6">
                  AI/LLM Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current Provider: {llmStatus?.current_provider || 'Loading...'}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={1}>
              <Button
                startIcon={<Refresh />}
                onClick={fetchLlmStatus}
                disabled={loadingLlmStatus}
                size="small"
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                onClick={testLlmConnection}
                disabled={testingConnection}
                size="small"
              >
                {testingConnection ? <CircularProgress size={16} /> : 'Test Connection'}
              </Button>
            </Box>
          </Box>

          {/* Provider Selection */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={6}>
              <Card 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  bgcolor: llmStatus?.current_provider === 'LOCAL' ? 'action.selected' : 'background.paper',
                  border: llmStatus?.current_provider === 'LOCAL' ? 2 : 1,
                  borderColor: llmStatus?.current_provider === 'LOCAL' ? 'primary.main' : 'divider'
                }}
              >
                <Box display="flex" alignItems="center" gap={2} mb={1}>
                  <Computer />
                  <Typography variant="h6">Local LLM (Ollama)</Typography>
                  {getProviderStatusIcon('LOCAL')}
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Free, private, runs on your hardware
                </Typography>
                <Box display="flex" gap={1} mb={2}>
                  <Chip 
                    label={llmStatus?.ollama_configured ? "Available" : "Not Available"} 
                    color={getProviderStatusColor('LOCAL')} 
                    size="small" 
                  />
                  {llmStatus?.available_models?.ollama && (
                    <Chip 
                      label={`${llmStatus.available_models.ollama.length} models`} 
                      size="small" 
                    />
                  )}
                </Box>
                <Button
                  fullWidth
                  variant={llmStatus?.current_provider === 'LOCAL' ? 'contained' : 'outlined'}
                  onClick={() => switchLlmProvider('LOCAL')}
                  disabled={!llmStatus?.ollama_configured || switchingProvider || llmStatus?.current_provider === 'LOCAL'}
                >
                  {llmStatus?.current_provider === 'LOCAL' ? 'Active' : 'Switch to Local'}
                </Button>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card 
                variant="outlined" 
                sx={{ 
                  p: 2,
                  bgcolor: llmStatus?.current_provider === 'OPENAI' ? 'action.selected' : 'background.paper',
                  border: llmStatus?.current_provider === 'OPENAI' ? 2 : 1,
                  borderColor: llmStatus?.current_provider === 'OPENAI' ? 'primary.main' : 'divider'
                }}
              >
                <Box display="flex" alignItems="center" gap={2} mb={1}>
                  <CloudQueue />
                  <Typography variant="h6">OpenAI</Typography>
                  {getProviderStatusIcon('OPENAI')}
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  High performance, large context models
                </Typography>
                <Box display="flex" gap={1} mb={2}>
                  <Chip 
                    label={llmStatus?.openai_configured ? "API Key Set" : "No API Key"} 
                    color={getProviderStatusColor('OPENAI')} 
                    size="small" 
                  />
                  {llmStatus?.available_models?.openai && (
                    <Chip 
                      label={`${llmStatus.available_models.openai.length} models`} 
                      size="small" 
                    />
                  )}
                </Box>
                <Button
                  fullWidth
                  variant={llmStatus?.current_provider === 'OPENAI' ? 'contained' : 'outlined'}
                  onClick={() => switchLlmProvider('OPENAI')}
                  disabled={!llmStatus?.openai_configured || switchingProvider || llmStatus?.current_provider === 'OPENAI'}
                >
                  {llmStatus?.current_provider === 'OPENAI' ? 'Active' : 'Switch to OpenAI'}
                </Button>
              </Card>
            </Grid>
          </Grid>

          {/* Status Details */}
          {llmStatus && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">Advanced Status & Model Information</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>OpenAI Status</Typography>
                    {llmStatus.openai_status?.valid ? (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        ✅ OpenAI API connected successfully
                        {llmStatus.openai_status?.organization_id && (
                          <Typography variant="caption" display="block">
                            Org: {llmStatus.openai_status.organization_id}
                          </Typography>
                        )}
                      </Alert>
                    ) : (
                      <Alert 
                        severity={llmStatus.openai_status?.error_type === 'quota_exceeded' ? 'warning' : 'error'} 
                        sx={{ mb: 2 }}
                      >
                        {llmStatus.openai_status?.error_type === 'quota_exceeded' ? '⚠️' : '❌'} 
                        {llmStatus.openai_status?.error || 'Not connected'}
                        {llmStatus.openai_status?.suggestion && (
                          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                            💡 {llmStatus.openai_status.suggestion}
                          </Typography>
                        )}
                      </Alert>
                    )}
                    {llmStatus.available_models?.openai && (
                      <List dense>
                        {llmStatus.available_models.openai.slice(0, 3).map((model: string) => {
                          const details = modelDetails[model]
                          return (
                            <ListItem key={model}>
                              <ListItemIcon>
                                <CloudQueue fontSize="small" />
                              </ListItemIcon>
                              <ListItemText 
                                primary={
                                  <Box display="flex" alignItems="center" gap={1}>
                                    {model}
                                    {details?.tier && (
                                      <Chip 
                                        label={details.tier} 
                                        size="small" 
                                        variant="outlined"
                                        color={details.tier === 'premium' ? 'primary' : 'default'}
                                      />
                                    )}
                                  </Box>
                                }
                                secondary={
                                  <Box>
                                    <Typography variant="caption">
                                      {details?.context_window?.toLocaleString() || 'Unknown'} tokens
                                      {details?.cost_per_1k && ` • $${details.cost_per_1k}/1k tokens`}
                                    </Typography>
                                    {details?.recommended_for && (
                                      <Box mt={0.5}>
                                        {renderModelRecommendations(details.recommended_for)}
                                      </Box>
                                    )}
                                  </Box>
                                }
                              />
                            </ListItem>
                          )
                        })}
                      </List>
                    )}
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Local LLM Status</Typography>
                    {llmStatus.ollama_status?.valid ? (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        ✅ Ollama connected successfully
                      </Alert>
                    ) : (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        ❌ {llmStatus.ollama_status?.error || 'Not connected'}
                      </Alert>
                    )}
                    {llmStatus.available_models?.ollama && (
                      <List dense>
                        {llmStatus.available_models.ollama.slice(0, 3).map((model: string) => {
                          const details = modelDetails[model]
                          return (
                            <ListItem key={model}>
                              <ListItemIcon>
                                <Computer fontSize="small" />
                              </ListItemIcon>
                              <ListItemText 
                                primary={
                                  <Box display="flex" alignItems="center" gap={1}>
                                    {model}
                                    {details?.tier && (
                                      <Chip 
                                        label={details.tier} 
                                        size="small" 
                                        variant="outlined"
                                      />
                                    )}
                                  </Box>
                                }
                                secondary={
                                  <Box>
                                    <Typography variant="caption">
                                      {details?.context_window?.toLocaleString() || 'Unknown'} tokens
                                      {details?.memory_gb && ` • ${details.memory_gb}GB RAM`}
                                    </Typography>
                                    {details?.recommended_for && (
                                      <Box mt={0.5}>
                                        {renderModelRecommendations(details.recommended_for)}
                                      </Box>
                                    )}
                                  </Box>
                                }
                              />
                            </ListItem>
                          )
                        })}
                      </List>
                    )}
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* OpenAI Configuration Card */}
      {llmStatus?.openai_status?.error_type === 'quota_exceeded' && (
        <Card sx={{ mb: 3, bgcolor: 'warning.light' }}>
          <CardContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                OpenAI Quota Exceeded
              </Typography>
              <Typography variant="body2" gutterBottom>
                Your OpenAI API quota has been exceeded. Here are your options:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="• Check your OpenAI billing dashboard and add credits" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Switch to local LLM for free processing" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Verify your organization ID is correct" />
                </ListItem>
              </List>
            </Alert>
            <ButtonGroup>
              <Button
                variant="outlined"
                onClick={() => window.open('https://platform.openai.com/account/billing', '_blank')}
              >
                Open Billing Dashboard
              </Button>
              <Button
                variant="contained"
                onClick={() => switchLlmProvider('LOCAL')}
                disabled={!llmStatus?.ollama_configured}
              >
                Switch to Local LLM
              </Button>
            </ButtonGroup>
          </CardContent>
        </Card>
      )}

      {/* OpenAI Settings Configuration Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            OpenAI Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Configure your OpenAI API settings for cloud-based LLM processing
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="API Key"
                type="password"
                placeholder="sk-..."
                helperText={settings?.openai_api_key_configured ? "API key is configured" : "No API key set"}
                InputProps={{
                  startAdornment: settings?.openai_api_key_configured ? (
                    <CheckCircle color="success" sx={{ mr: 1 }} />
                  ) : (
                    <Warning color="warning" sx={{ mr: 1 }} />
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Organization ID"
                placeholder="org-..."
                defaultValue={settings?.openai_organization_id || ''}
                helperText="Optional: Your OpenAI organization ID"
              />
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => window.open('https://platform.openai.com/api-keys', '_blank')}
                >
                  Get API Key
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => window.open('https://platform.openai.com/account/org-settings', '_blank')}
                >
                  Find Organization ID
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            {/* Application Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Application Settings
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Application Name"
                error={!!errors.app_name}
                helperText={errors.app_name?.message}
                {...register('app_name', {
                  required: 'Application name is required',
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    {...register('debug_mode')}
                    defaultChecked={settings?.debug_mode}
                  />
                }
                label="Debug Mode"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Document Processing
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Max File Size (MB)"
                inputProps={{ min: 1 }}
                error={!!errors.max_file_size_mb}
                helperText={errors.max_file_size_mb?.message}
                {...register('max_file_size_mb', {
                  required: 'Max file size is required',
                  min: {
                    value: 1,
                    message: 'Must be at least 1MB',
                  },
                })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Chunk Size"
                inputProps={{ min: 100 }}
                error={!!errors.chunk_size}
                helperText={errors.chunk_size?.message}
                {...register('chunk_size', {
                  required: 'Chunk size is required',
                  min: {
                    value: 100,
                    message: 'Must be at least 100',
                  },
                })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Chunk Overlap"
                inputProps={{ min: 0 }}
                error={!!errors.chunk_overlap}
                helperText={errors.chunk_overlap?.message}
                {...register('chunk_overlap', {
                  required: 'Chunk overlap is required',
                  min: {
                    value: 0,
                    message: 'Must be at least 0',
                  },
                })}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Worker Settings
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Worker Batch Size"
                inputProps={{ min: 1 }}
                error={!!errors.worker_batch_size}
                helperText={errors.worker_batch_size?.message}
                {...register('worker_batch_size', {
                  required: 'Worker batch size is required',
                  min: {
                    value: 1,
                    message: 'Must be at least 1',
                  },
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Worker Timeout (seconds)"
                inputProps={{ min: 30 }}
                error={!!errors.worker_timeout_seconds}
                helperText={errors.worker_timeout_seconds?.message}
                {...register('worker_timeout_seconds', {
                  required: 'Worker timeout is required',
                  min: {
                    value: 30,
                    message: 'Must be at least 30 seconds',
                  },
                })}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <SmartToy />
                <Typography variant="h6">
                  AI/LLM Model Settings
                </Typography>
                <Chip 
                  label={llmStatus?.current_provider || "Unknown"} 
                  color="primary" 
                  size="small" 
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>LLM Model</InputLabel>
                <Select
                  {...register('llm_model', { required: 'LLM model is required' })}
                  label="LLM Model"
                  error={!!errors.llm_model}
                  value={watch('llm_model') || ''}
                  onChange={(e) => setValue('llm_model', e.target.value)}
                >
                  {llmStatus?.current_provider === 'OPENAI' 
                    ? settings?.available_openai_models?.map((model) => (
                        <MenuItem key={model} value={model}>
                          <Box display="flex" alignItems="center" gap={1}>
                            {model}
                            {modelDetails[model] && (
                              <Chip 
                                label={modelDetails[model].tier || 'unknown'} 
                                size="small" 
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </MenuItem>
                      ))
                    : settings?.available_local_models?.map((model) => (
                        <MenuItem key={model} value={model}>
                          <Box display="flex" alignItems="center" gap={1}>
                            {model}
                            {modelDetails[model] && (
                              <Chip 
                                label={modelDetails[model].tier || 'unknown'} 
                                size="small" 
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </MenuItem>
                      ))
                  }
                </Select>
                {errors.llm_model && (
                  <Typography variant="caption" color="error">
                    {errors.llm_model.message}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Current provider: {llmStatus?.current_provider || 'Unknown'}
                  {watch('llm_model') && modelDetails[watch('llm_model')] && (
                    <span> • {modelDetails[watch('llm_model')].context_window?.toLocaleString()} tokens</span>
                  )}
                </Typography>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Embedding Model</InputLabel>
                <Select
                  {...register('embedding_model', { required: 'Embedding model is required' })}
                  label="Embedding Model"
                  error={!!errors.embedding_model}
                  value={watch('embedding_model') || ''}
                  onChange={(e) => setValue('embedding_model', e.target.value)}
                >
                  <MenuItem value="text-embedding-3-small">text-embedding-3-small (Recommended)</MenuItem>
                  <MenuItem value="text-embedding-3-large">text-embedding-3-large (High Quality)</MenuItem>
                  <MenuItem value="text-embedding-ada-002">text-embedding-ada-002 (Legacy)</MenuItem>
                </Select>
                {errors.embedding_model && (
                  <Typography variant="caption" color="error">
                    {errors.embedding_model.message}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  For semantic search and document indexing
                </Typography>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Max Tokens"
                inputProps={{ min: 1 }}
                error={!!errors.llm_max_tokens}
                helperText={errors.llm_max_tokens?.message || "Maximum response length"}
                {...register('llm_max_tokens', {
                  required: 'Max tokens is required',
                  min: {
                    value: 1,
                    message: 'Must be at least 1',
                  },
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Temperature"
                inputProps={{ step: 0.1, min: 0, max: 1 }}
                error={!!errors.llm_temperature}
                helperText={errors.llm_temperature?.message || "0.0 = focused, 1.0 = creative"}
                {...register('llm_temperature', {
                  required: 'Temperature is required',
                  min: {
                    value: 0,
                    message: 'Must be at least 0',
                  },
                  max: {
                    value: 1,
                    message: 'Must be at most 1',
                  },
                })}
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving}
                >
                  {saving ? <CircularProgress size={20} /> : 'Save Settings'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  )
} 