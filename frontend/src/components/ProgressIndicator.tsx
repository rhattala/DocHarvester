import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Collapse,
  Stack,
  Alert,
  Tooltip
} from '@mui/material'
import {
  ExpandMore,
  ExpandLess,
  Cancel,
  Article,
  Psychology,
  AccountTree,
  Settings,
  CheckCircle,
  Error,
  Schedule
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

// Create axios instance with auth
const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth interceptor
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

interface Operation {
  id: number
  type: string
  status: string
  progress: number
  current_step: string
  estimated_duration: number
  remaining_time: number
  started_at: string
  title: string
  description: string
  icon: string
}

interface ProgressIndicatorProps {
  projectId: number
  compact?: boolean
  onOperationComplete?: (operation: Operation) => void
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  projectId,
  compact = false,
  onOperationComplete
}) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const queryClient = useQueryClient()

  // Fetch active operations
  const { data: operationsData, isLoading } = useQuery({
    queryKey: ['active-operations', projectId],
    queryFn: () => apiClient.get(`/progress/projects/${projectId}/active-operations`).then(res => res.data),
    refetchInterval: 2000, // Poll every 2 seconds
    enabled: !!projectId,
  })

  // Cancel task mutation
  const cancelTaskMutation = useMutation({
    mutationFn: (taskId: number) => apiClient.delete(`/progress/tasks/${taskId}`).then(res => res.data),
    onSuccess: () => {
      toast.success('Operation cancelled successfully')
      queryClient.invalidateQueries({ queryKey: ['active-operations', projectId] })
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to cancel operation'
      toast.error(message)
    }
  })

  const operations: Operation[] = operationsData?.operations || []

  // Notify when operations complete
  useEffect(() => {
    if (onOperationComplete) {
      operations.forEach(op => {
        if (op.status === 'completed' && onOperationComplete) {
          onOperationComplete(op)
        }
      })
    }
  }, [operations, onOperationComplete])

  const toggleExpanded = (operationId: number) => {
    setExpanded(prev => {
      const newSet = new Set(prev)
      if (newSet.has(operationId)) {
        newSet.delete(operationId)
      } else {
        newSet.add(operationId)
      }
      return newSet
    })
  }

  const getOperationIcon = (iconName: string, status: string) => {
    const iconProps = { 
      sx: { 
        color: status === 'completed' ? 'success.main' : status === 'failed' ? 'error.main' : 'primary.main',
        fontSize: compact ? 20 : 24
      } 
    }
    
    switch (iconName) {
      case 'article': return <Article {...iconProps} />
      case 'psychology': return <Psychology {...iconProps} />
      case 'account_tree': return <AccountTree {...iconProps} />
      default: return <Settings {...iconProps} />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle sx={{ color: 'success.main', fontSize: 16 }} />
      case 'failed': return <Error sx={{ color: 'error.main', fontSize: 16 }} />
      default: return null
    }
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  const formatETA = (remainingSeconds: number): string => {
    if (remainingSeconds <= 0) return 'Completing...'
    return `ETA: ${formatTime(remainingSeconds)}`
  }

  const getProgressColor = (progress: number, status: string) => {
    if (status === 'completed') return 'success'
    if (status === 'failed') return 'error'
    if (progress > 80) return 'success'
    if (progress > 50) return 'primary'
    return 'primary'
  }

  if (isLoading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Checking for active operations...
          </Typography>
        </CardContent>
      </Card>
    )
  }

  if (!operations.length) {
    return null // No active operations
  }

  return (
    <Stack spacing={2}>
      {operations.map((operation) => (
        <Card key={operation.id} variant="outlined" sx={{ borderLeft: 4, borderLeftColor: 'primary.main' }}>
          <CardContent sx={{ py: compact ? 1.5 : 2 }}>
            {/* Header */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Box display="flex" alignItems="center" gap={1.5}>
                {getOperationIcon(operation.icon, operation.status)}
                <Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant={compact ? "body2" : "subtitle1"} fontWeight="medium">
                      {operation.title}
                    </Typography>
                    {getStatusIcon(operation.status)}
                    <Chip 
                      label={operation.status} 
                      size="small" 
                      color={operation.status === 'completed' ? 'success' : operation.status === 'failed' ? 'error' : 'primary'}
                      variant="outlined"
                    />
                  </Box>
                  {!compact && (
                    <Typography variant="body2" color="text.secondary">
                      {operation.description}
                    </Typography>
                  )}
                </Box>
              </Box>
              
              <Box display="flex" alignItems="center" gap={1}>
                {operation.status === 'running' && operation.remaining_time > 0 && (
                  <Tooltip title="Estimated time remaining">
                    <Chip 
                      icon={<Schedule sx={{ fontSize: 14 }} />}
                      label={formatETA(operation.remaining_time)}
                      size="small"
                      variant="outlined"
                    />
                  </Tooltip>
                )}
                
                {operation.status === 'running' && (
                  <Tooltip title="Cancel operation">
                    <IconButton 
                      size="small" 
                      onClick={() => cancelTaskMutation.mutate(operation.id)}
                      disabled={cancelTaskMutation.isPending}
                    >
                      <Cancel />
                    </IconButton>
                  </Tooltip>
                )}
                
                {!compact && (
                  <IconButton 
                    size="small" 
                    onClick={() => toggleExpanded(operation.id)}
                  >
                    {expanded.has(operation.id) ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* Progress Bar */}
            <Box mb={1}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {operation.current_step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(operation.progress)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={operation.progress}
                color={getProgressColor(operation.progress, operation.status)}
                sx={{ 
                  height: compact ? 4 : 6, 
                  borderRadius: 3,
                  backgroundColor: 'grey.200'
                }}
              />
            </Box>

            {/* Expandable Details */}
            {!compact && (
              <Collapse in={expanded.has(operation.id)} timeout="auto" unmountOnExit>
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Started:</strong> {new Date(operation.started_at).toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Estimated Duration:</strong> {formatTime(operation.estimated_duration)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Operation ID:</strong> {operation.id}
                  </Typography>
                </Alert>
              </Collapse>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}

export default ProgressIndicator