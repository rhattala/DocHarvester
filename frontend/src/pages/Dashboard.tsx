import { Grid, Paper, Typography, Box, Card, CardContent, CircularProgress, Alert, Button } from '@mui/material'
import { Folder, Description, Assessment, TrendingUp } from '@mui/icons-material'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export default function Dashboard() {
  // Fetch projects for statistics
  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
    retry: 1
  })

  // Fetch lens statistics
  const { data: lensStats } = useQuery({
    queryKey: ['lens-stats'],
    queryFn: () => api.getLensStatistics(),
    retry: 1
  })

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard data'
    const errorDetails = (error as any)?.response?.data?.detail || 'Please check your connection and try again'
    
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {errorMessage}
          </Typography>
          <Typography variant="body2">
            {errorDetails}
          </Typography>
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => window.location.reload()}
          sx={{ mt: 1 }}
        >
          Reload Page
        </Button>
      </Box>
    )
  }

  // Calculate aggregate statistics
  const totalProjects = projects?.length || 0
  const totalDocuments = projects?.reduce((sum: number, p: any) => sum + p.document_count, 0) || 0
  const avgCoverage = projects?.length 
    ? Math.round(projects.reduce((sum: number, p: any) => sum + p.coverage_percentage, 0) / projects.length)
    : 0

  // Prepare coverage trend data (mock for now - would come from time series API)
  const coverageData = [
    { name: 'Week 1', coverage: 45 },
    { name: 'Week 2', coverage: 52 },
    { name: 'Week 3', coverage: 68 },
    { name: 'Week 4', coverage: 75 },
    { name: 'Current', coverage: avgCoverage },
  ]

  // Prepare documents by lens data
  const documentData = lensStats?.stats?.map((stat: any) => ({
    name: stat.lens_type,
    documents: stat.document_count,
    chunks: stat.chunk_count,
  })) || []

  const stats = [
    { title: 'Total Projects', value: totalProjects.toString(), icon: <Folder />, color: '#4F46E5' },
    { title: 'Documents', value: totalDocuments.toLocaleString(), icon: <Description />, color: '#10B981' },
    { title: 'Avg Coverage', value: `${avgCoverage}%`, icon: <Assessment />, color: '#F59E0B' },
    { title: 'Auto-Generated', value: '0', icon: <TrendingUp />, color: '#EF4444' },
  ]

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Stats Cards */}
        {stats.map((stat) => (
          <Grid item xs={12} sm={6} md={3} key={stat.title}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      {stat.title}
                    </Typography>
                    <Typography variant="h4">
                      {stat.value}
                    </Typography>
                  </Box>
                  <Box sx={{ color: stat.color }}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Coverage Trend Chart */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Coverage Trend
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={coverageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="coverage" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Documents by Type */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Documents by Lens
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={documentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="documents" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Recent Projects */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Projects
            </Typography>
            <Box>
              {projects?.slice(0, 5).map((project: any, index: number) => (
                <Box key={project.id} py={1} borderBottom={index < 4 ? 1 : 0} borderColor="divider">
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body1">
                        {project.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {project.document_count} documents • {Math.round(project.coverage_percentage)}% coverage
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(project.updated_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              ))}
              {(!projects || projects.length === 0) && (
                <Typography variant="body2" color="textSecondary">
                  No projects yet. Create your first project to get started.
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
} 