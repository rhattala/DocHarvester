import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Drawer,
  List,
  ListItemText,
  ListItemButton,
  Breadcrumbs,
  Link,
  Button,
  Alert,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Divider,
  Collapse,
  Skeleton,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Search,
  Refresh,
  ExpandMore,
  ExpandLess,
  AutoAwesome,
  Article,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import ProgressIndicator from '../components/ProgressIndicator'
import toast from 'react-hot-toast'

const DRAWER_WIDTH = 280

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

interface WikiPage {
  id: number
  title: string
  slug: string
  summary: string
  parent_id: number | null
  order_index: number
  status: string
  tags: string[]
  has_children: boolean
}

export default function Wiki() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [currentPageSlug, setCurrentPageSlug] = useState('index')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())

  // Fetch wiki generation status
  const { data: generationStatus } = useQuery({
    queryKey: ['wiki-generation-status', projectId],
    queryFn: () => apiClient.get(`/wiki/generation-status/${projectId}`).then((res: any) => res.data),
    enabled: !!projectId,
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
  })

  // Fetch wiki structure
  const { data: wikiStructure, isLoading: structureLoading } = useQuery({
    queryKey: ['wiki-structure', projectId],
    queryFn: () => apiClient.get(`/wiki/structure/${projectId}`).then((res: any) => res.data),
    enabled: !!projectId && generationStatus?.status === 'completed',
  })

  // Fetch wiki pages (root level)
  const { data: wikiPages, isLoading: pagesLoading } = useQuery({
    queryKey: ['wiki-pages', projectId],
    queryFn: () => apiClient.get(`/wiki/pages/${projectId}`).then((res: any) => res.data),
    enabled: !!projectId && generationStatus?.status === 'completed',
  })

  // Fetch current page
  const { data: currentPage, isLoading: pageLoading } = useQuery({
    queryKey: ['wiki-page', projectId, currentPageSlug],
    queryFn: () => apiClient.get(`/wiki/page/${projectId}/${currentPageSlug}`).then((res: any) => res.data),
    enabled: !!projectId && !!currentPageSlug && generationStatus?.status === 'completed',
  })

  // Generate wiki mutation
  const generateWikiMutation = useMutation({
    mutationFn: (forceRegenerate: boolean = false) =>
      apiClient.post(`/wiki/generate/${projectId}?force_regenerate=${forceRegenerate}`).then(res => res.data),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success('Wiki generation started! Track progress below.')
        queryClient.invalidateQueries({ queryKey: ['wiki-generation-status', projectId] })
        queryClient.invalidateQueries({ queryKey: ['active-operations', projectId] })
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || error.message || 'Failed to generate wiki'
      toast.error(message)
    }
  })

  // Search wiki
  const { data: searchResults } = useQuery({
    queryKey: ['wiki-search', projectId, searchQuery],
    queryFn: () => apiClient.get(`/wiki/search/${projectId}?q=${searchQuery}`).then((res: any) => res.data),
    enabled: !!projectId && searchQuery.length > 2 && generationStatus?.status === 'completed',
  })

  const handlePageClick = (slug: string) => {
    setCurrentPageSlug(slug)
  }

  const toggleSection = (pageId: number) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(pageId)) {
        newSet.delete(pageId)
      } else {
        newSet.add(pageId)
      }
      return newSet
    })
  }

  const handleOperationComplete = (operation: any) => {
    if (operation.type === 'wiki_generation') {
      // Refresh wiki data when generation completes
      queryClient.invalidateQueries({ queryKey: ['wiki-generation-status', projectId] })
      queryClient.invalidateQueries({ queryKey: ['wiki-structure', projectId] })
      queryClient.invalidateQueries({ queryKey: ['wiki-pages', projectId] })
      toast.success('Wiki generation completed successfully!')
    }
  }

  const renderWikiPage = (page: WikiPage, level: number = 0) => (
    <Box key={page.id}>
      <ListItemButton
        onClick={() => handlePageClick(page.slug)}
        selected={currentPageSlug === page.slug}
        sx={{ pl: level * 2 + 2 }}
      >
        <ListItemText
          primary={page.title}
          secondary={page.summary}
          secondaryTypographyProps={{
            noWrap: true,
            fontSize: 12,
            color: 'text.secondary',
          }}
        />
        {page.has_children && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              toggleSection(page.id)
            }}
          >
            {expandedSections.has(page.id) ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        )}
      </ListItemButton>
      {page.has_children && (
        <Collapse in={expandedSections.has(page.id)} timeout="auto" unmountOnExit>
          {/* Child pages would be loaded here */}
        </Collapse>
      )}
    </Box>
  )

  if (!projectId) {
    return <Alert severity="error">No project ID provided</Alert>
  }

  // Show progress indicator if wiki is being generated
  if (generationStatus?.status === 'running' || generationStatus?.status === 'pending') {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Wiki Generation in Progress
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Your wiki is being generated using AI. This may take a few minutes depending on the size of your project.
        </Typography>
        
        <ProgressIndicator 
          projectId={parseInt(projectId)} 
          onOperationComplete={handleOperationComplete}
        />
        
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            The wiki generation process analyzes your documents, extracts entities using the knowledge graph, 
            and creates comprehensive documentation using {generationStatus?.llm_used === 'openai' ? 'OpenAI for best quality results' : 'local LLM for faster processing'}.
          </Typography>
        </Alert>
      </Box>
    )
  }

  // Check if wiki needs to be generated
  if (generationStatus?.status === 'not_started' || (!structureLoading && !wikiStructure && !generateWikiMutation.isPending)) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="60vh"
        gap={3}
      >
        <Article sx={{ fontSize: 80, color: 'text.secondary' }} />
        <Typography variant="h5" color="text.secondary">
          No wiki found for this project
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" maxWidth={500}>
          Generate a comprehensive wiki from your project documents using AI. 
          The system will use OpenAI for best quality results and leverage your knowledge graph for context.
        </Typography>
        
        {generateWikiMutation.isError && (
          <Alert severity="error" sx={{ maxWidth: 500, width: '100%' }}>
            {(generateWikiMutation.error as any)?.response?.data?.detail || 
             'Failed to generate wiki. Please check your OpenAI API key configuration.'}
          </Alert>
        )}

        {/* Show progress indicator if there are any active operations */}
        <ProgressIndicator 
          projectId={parseInt(projectId)} 
          compact={true}
          onOperationComplete={handleOperationComplete}
        />
        
        <Button
          variant="contained"
          size="large"
          startIcon={<AutoAwesome />}
          onClick={() => generateWikiMutation.mutate(false)}
          disabled={generateWikiMutation.isPending}
        >
          {generateWikiMutation.isPending ? 'Starting Generation...' : 'Generate Wiki with AI'}
        </Button>
        
        <Typography variant="caption" color="text.secondary" textAlign="center">
          Uses OpenAI for comprehensive analysis • Leverages knowledge graph for context • Typically takes 2-5 minutes
        </Typography>
      </Box>
    )
  }

  // Show error state
  if (generationStatus?.status === 'failed') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">Wiki Generation Failed</Typography>
          <Typography variant="body2">
            {generationStatus.error_message || 'An error occurred during wiki generation.'}
          </Typography>
        </Alert>
        
        <Button
          variant="contained"
          startIcon={<AutoAwesome />}
          onClick={() => generateWikiMutation.mutate(true)}
          disabled={generateWikiMutation.isPending}
        >
          Retry Wiki Generation
        </Button>
      </Box>
    )
  }

  return (
    <Box display="flex" height="100vh">
      {/* Progress Indicator Bar (if any active operations) */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          backgroundColor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          p: 1
        }}
      >
        <ProgressIndicator 
          projectId={parseInt(projectId)} 
          compact={true}
          onOperationComplete={handleOperationComplete}
        />
      </Box>

      {/* Sidebar */}
      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            position: 'relative',
            height: '100%',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Wiki Navigation
          </Typography>
          
          {/* Search */}
          <TextField
            size="small"
            fullWidth
            placeholder="Search wiki..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {/* Wiki Pages Tree */}
          {pagesLoading ? (
            <Box>
              <Skeleton variant="text" height={40} />
              <Skeleton variant="text" height={40} />
              <Skeleton variant="text" height={40} />
            </Box>
          ) : (
            <List dense>
              {wikiPages?.pages?.map((page: WikiPage) => renderWikiPage(page))}
            </List>
          )}
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : 0}px)`,
          transition: 'width 0.3s',
          mt: 8, // Account for progress indicator bar
        }}
      >
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => setDrawerOpen(!drawerOpen)}>
              <MenuIcon />
            </IconButton>
            <Breadcrumbs>
              <Link
                component="button"
                variant="body1"
                onClick={() => navigate('/projects')}
                underline="hover"
              >
                Projects
              </Link>
              <Link
                component="button"
                variant="body1"
                onClick={() => navigate(`/projects/${projectId}`)}
                underline="hover"
              >
                Project Details
              </Link>
              <Typography color="text.primary">Wiki</Typography>
            </Breadcrumbs>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              startIcon={<Refresh />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['wiki-page', projectId, currentPageSlug] })}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<AutoAwesome />}
              onClick={() => generateWikiMutation.mutate(true)}
              disabled={generateWikiMutation.isPending}
            >
              Regenerate
            </Button>
          </Box>
        </Box>

        {/* Page Content */}
        {pageLoading ? (
          <Box>
            <Skeleton variant="text" height={60} width="50%" />
            <Skeleton variant="text" height={30} width="80%" />
            <Skeleton variant="rectangular" height={400} sx={{ mt: 2 }} />
          </Box>
        ) : currentPage ? (
          <Paper sx={{ p: 4 }}>
            {/* Page Header */}
            <Box mb={3}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h4">{currentPage.title}</Typography>
                <Box display="flex" gap={1}>
                  {currentPage.is_generated && (
                    <Chip
                      icon={<AutoAwesome />}
                      label="AI Generated"
                      size="small"
                      color="primary"
                    />
                  )}
                  <Chip
                    label={`${currentPage.view_count} views`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>
              {currentPage.summary && (
                <Typography variant="subtitle1" color="text.secondary" paragraph>
                  {currentPage.summary}
                </Typography>
              )}
              {currentPage.tags.length > 0 && (
                <Box display="flex" gap={1} mb={2}>
                  {currentPage.tags.map((tag: string) => (
                    <Chip key={tag} label={tag} size="small" />
                  ))}
                </Box>
              )}
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Markdown Content */}
            <Box className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    return match ? (
                      <SyntaxHighlighter
                        style={tomorrow as any}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {currentPage.content}
              </ReactMarkdown>
            </Box>

            {/* Child Pages */}
            {currentPage.children.length > 0 && (
              <Box mt={4}>
                <Typography variant="h6" gutterBottom>
                  Sub-pages
                </Typography>
                <List>
                  {currentPage.children.map((child: WikiPage) => (
                    <ListItemButton
                      key={child.id}
                      onClick={() => handlePageClick(child.slug)}
                    >
                      <ListItemText
                        primary={child.title}
                        secondary={child.summary}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}
          </Paper>
        ) : (
          <Alert severity="info">Select a page from the navigation</Alert>
        )}

        {/* Search Results */}
        {searchResults && searchQuery.length > 2 && (
          <Paper sx={{ position: 'absolute', top: 100, right: 20, p: 2, maxWidth: 400 }}>
            <Typography variant="subtitle2" gutterBottom>
              Search Results
            </Typography>
            <List dense>
              {searchResults.results.map((result: any) => (
                <ListItemButton
                  key={result.id}
                  onClick={() => {
                    handlePageClick(result.slug)
                    setSearchQuery('')
                  }}
                >
                  <ListItemText
                    primary={result.title}
                    secondary={result.excerpt}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
      </Box>
    </Box>
  )
} 