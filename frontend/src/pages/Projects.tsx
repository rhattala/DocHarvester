import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Grid,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material'
import { Add, Folder, MoreVert, Upload } from '@mui/icons-material'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { api, Project } from '../services/api'

interface ProjectForm {
  name: string
  description: string
  tags: string
}

export default function Projects() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProjectForm>()

  // Fetch projects
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  })

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; tags?: string[] }) => 
      api.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created successfully!')
      setOpen(false)
      reset()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create project')
    },
  })

  const handleCreateProject = async (data: ProjectForm) => {
    const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    createProjectMutation.mutate({
      name: data.name,
      description: data.description,
      tags,
    })
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error">Failed to load projects. Please try again.</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Projects</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpen(true)}
        >
          New Project
        </Button>
      </Box>

      <Grid container spacing={3}>
        {projects?.map((project: Project) => (
          <Grid item xs={12} md={6} lg={4} key={project.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start">
                  <Box flex={1}>
                    <Typography variant="h6" gutterBottom>
                      {project.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      {project.description || 'No description provided'}
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                      {project.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Box>
                    <Box display="flex" gap={3}>
                      <Typography variant="body2">
                        <strong>{project.document_count}</strong> documents
                      </Typography>
                      <Typography variant="body2">
                        <strong>{Math.round(project.coverage_percentage)}%</strong> coverage
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton size="small">
                    <MoreVert />
                  </IconButton>
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate(`/projects/${project.id}`)}>
                  View Details
                </Button>
                <Button 
                  size="small" 
                  startIcon={<Upload />}
                  onClick={() => navigate(`/projects/${project.id}?tab=upload`)}
                >
                  Upload Docs
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
        
        {(!projects || projects.length === 0) && (
          <Grid item xs={12}>
            <Box textAlign="center" py={8}>
              <Folder sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                No projects yet
              </Typography>
              <Typography variant="body2" color="textSecondary" mb={3}>
                Create your first project to start ingesting and analyzing documentation
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setOpen(true)}
              >
                Create First Project
              </Button>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Create Project Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(handleCreateProject)}>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Project Name"
              fullWidth
              variant="outlined"
              error={!!errors.name}
              helperText={errors.name?.message}
              {...register('name', { required: 'Project name is required' })}
            />
            <TextField
              margin="dense"
              label="Description"
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              {...register('description')}
            />
            <TextField
              margin="dense"
              label="Tags (comma separated)"
              fullWidth
              variant="outlined"
              placeholder="e.g., frontend, react, documentation"
              {...register('tags')}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained"
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? <CircularProgress size={20} /> : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
} 