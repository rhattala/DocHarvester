import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  Button,
} from '@mui/material'
import { Assessment, CheckCircle, Warning, Error as ErrorIcon } from '@mui/icons-material'
import { api } from '../services/api'
import { useNavigate } from 'react-router-dom'

const LENS_COLORS = {
  LOGIC: '#4F46E5',
  SOP: '#10B981',
  GTM: '#F59E0B',
  CL: '#EF4444',
}

export default function Coverage() {
  const navigate = useNavigate()
  const [selectedProject, setSelectedProject] = useState<number | null>(null)

  // Fetch all projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  })

  // Fetch coverage for selected project
  const { data: coverage } = useQuery({
    queryKey: ['project-coverage', selectedProject],
    queryFn: () => selectedProject ? api.getCoverageStatus(selectedProject) : null,
    enabled: !!selectedProject,
  })

  if (projectsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  // Calculate overall statistics
  const totalProjects = projects?.length || 0
  const projectsWithGoodCoverage = projects?.filter(p => p.coverage_percentage >= 80).length || 0
  const projectsWithPoorCoverage = projects?.filter(p => p.coverage_percentage < 50).length || 0
  const avgCoverage = projects?.length 
    ? Math.round(projects.reduce((sum, p) => sum + p.coverage_percentage, 0) / projects.length)
    : 0

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Coverage Analysis
      </Typography>

      {/* Overall Statistics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Assessment color="primary" />
                <Typography variant="h6">Average Coverage</Typography>
              </Box>
              <Typography variant="h3">{avgCoverage}%</Typography>
              <LinearProgress
                variant="determinate"
                value={avgCoverage}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CheckCircle color="success" />
                <Typography variant="h6">Good Coverage</Typography>
              </Box>
              <Typography variant="h3">{projectsWithGoodCoverage}</Typography>
              <Typography variant="body2" color="textSecondary">
                Projects with ≥80% coverage
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Warning color="warning" />
                <Typography variant="h6">Needs Attention</Typography>
              </Box>
              <Typography variant="h3">{totalProjects - projectsWithGoodCoverage - projectsWithPoorCoverage}</Typography>
              <Typography variant="body2" color="textSecondary">
                Projects with 50-79% coverage
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <ErrorIcon color="error" />
                <Typography variant="h6">Poor Coverage</Typography>
              </Box>
              <Typography variant="h3">{projectsWithPoorCoverage}</Typography>
              <Typography variant="body2" color="textSecondary">
                Projects with &lt;50% coverage
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Projects Coverage List */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Projects Coverage Status
            </Typography>
            <List>
              {projects?.map((project) => {
                const coverageColor = 
                  project.coverage_percentage >= 80 ? 'success' :
                  project.coverage_percentage >= 50 ? 'warning' : 'error'
                
                return (
                  <ListItem
                    key={project.id}
                    button
                    selected={selectedProject === project.id}
                    onClick={() => setSelectedProject(project.id)}
                  >
                    <ListItemText
                      primary={project.name}
                      secondary={
                        <Box>
                          <LinearProgress
                            variant="determinate"
                            value={project.coverage_percentage}
                            color={coverageColor}
                            sx={{ mt: 1, mb: 0.5 }}
                          />
                          <Typography variant="caption">
                            {Math.round(project.coverage_percentage)}% coverage • {project.document_count} documents
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                )
              })}
            </List>
          </Paper>
        </Grid>

        {/* Selected Project Details */}
        <Grid item xs={12} md={6}>
          {selectedProject && coverage ? (
            <Paper sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  {coverage.project_name} - Lens Coverage
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate(`/projects/${selectedProject}?tab=coverage`)}
                >
                  View Details
                </Button>
              </Box>
              
              <Grid container spacing={2}>
                {coverage.status.map((status) => {
                  const icon = status.status === 'complete' ? <CheckCircle color="success" /> :
                             status.status === 'good' ? <CheckCircle color="primary" /> :
                             status.status === 'partial' ? <Warning color="warning" /> :
                             <ErrorIcon color="error" />
                  
                  return (
                    <Grid item xs={12} key={status.lens_type}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Chip
                          label={status.lens_type}
                          sx={{
                            bgcolor: LENS_COLORS[status.lens_type as keyof typeof LENS_COLORS],
                            color: 'white',
                            minWidth: 60,
                          }}
                        />
                        <Box flex={1}>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2">
                              {status.document_count} docs • {status.chunk_count} chunks
                            </Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                              {icon}
                              <Typography variant="body2" fontWeight="bold">
                                {Math.round(status.coverage_percentage)}%
                              </Typography>
                            </Box>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={status.coverage_percentage}
                            sx={{ mt: 0.5 }}
                          />
                        </Box>
                      </Box>
                    </Grid>
                  )
                })}
              </Grid>

              {/* Recommendations */}
              {coverage.recommendations.length > 0 && (
                <Box mt={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Recommendations
                  </Typography>
                  {coverage.recommendations.slice(0, 3).map((rec, index) => (
                    <Alert
                      key={index}
                      severity={
                        rec.priority === 'high' ? 'error' :
                        rec.priority === 'medium' ? 'warning' : 'info'
                      }
                      sx={{ mb: 1 }}
                    >
                      {rec.message}
                    </Alert>
                  ))}
                </Box>
              )}
            </Paper>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                Select a project to view detailed coverage
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  )
} 