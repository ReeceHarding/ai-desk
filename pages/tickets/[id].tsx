import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { 
  Button, 
  TextInput, 
  Textarea, 
  Select, 
  Paper,
  ActionIcon,
  Drawer,
  Group,
  Text,
  Avatar,
  Box,
  Divider,
  ScrollArea,
  Timeline,
  Badge,
  Menu,
  Tooltip,
  Loader,
  Container,
  Stack,
  Grid,
  Card,
  Skeleton,
  Flex,
  ThemeIcon,
} from '@mantine/core';
import { useUserRole } from '@/hooks/useUserRole';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  IconX, 
  IconSend, 
  IconPaperclip,
  IconClock,
  IconEyePause,
  IconCheck,
  IconLock,
  IconInbox,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconStar,
  IconBell,
  IconBellOff,
  IconShare,
  IconArrowLeft,
  IconMessageCircle,
  IconAlertCircle,
  IconUser,
  IconBuilding,
  IconCalendar,
  IconTag,
} from '@tabler/icons-react';

type Profile = {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Organization = {
  name: string | null;
};

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: Profile | null;
  organization: Organization | null;
};

type Comment = Database['public']['Tables']['comments']['Row'] & {
  author: Profile | null;
};

const statusColors: Record<string, string> = {
  open: 'blue',
  pending: 'yellow',
  on_hold: 'orange',
  solved: 'green',
  closed: 'gray',
};

const priorityColors: Record<string, string> = {
  low: 'blue',
  medium: 'yellow',
  high: 'orange',
  urgent: 'red',
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'open':
      return <IconInbox size={14} />;
    case 'pending':
      return <IconClock size={14} />;
    case 'on_hold':
      return <IconEyePause size={14} />;
    case 'solved':
      return <IconCheck size={14} />;
    case 'closed':
      return <IconLock size={14} />;
    default:
      return null;
  }
};

export default function TicketDetail() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [isStarred, setIsStarred] = useState(false);

  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();
  const { role } = useUserRole();

  useEffect(() => {
    if (!router.isReady || !user) return;

    const ticketId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
    if (!ticketId) {
      router.push('/tickets');
      return;
    }

    async function fetchTicketAndComments() {
      // Fetch ticket with customer details
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey (
            display_name,
            email,
            avatar_url
          ),
          organization:organizations!tickets_org_id_fkey (
            name
          )
        `)
        .eq('id', ticketId as string)
        .single();

      if (ticketError) {
        console.error('Error fetching ticket:', ticketError);
        return;
      }

      if (ticketData) {
        const typedTicket: Ticket = {
          ...ticketData,
          customer: ticketData.customer as Profile,
          organization: ticketData.organization as Organization,
        };
        setTicket(typedTicket);
      }

      // Fetch comments with author details
      const { data: commentData, error: commentError } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles!comments_author_id_fkey (
            display_name,
            email,
            avatar_url
          )
        `)
        .eq('ticket_id', ticketId as string)
        .order('created_at', { ascending: true });

      if (commentError) {
        console.error('Error fetching comments:', commentError);
        return;
      }

      if (commentData) {
        const typedComments: Comment[] = commentData.map(comment => ({
          ...comment,
          author: comment.author as Profile,
        }));
        setComments(typedComments);
      }

      setLoading(false);
    }

    fetchTicketAndComments();
  }, [router.isReady, router.query.id, user, supabase]);

  const handleStatusChange = async (newStatus: Ticket['status']) => {
    if (!ticket || !user) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticket.id);

      if (error) throw error;

      setTicket({ ...ticket, status: newStatus });
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const handlePriorityChange = async (newPriority: Ticket['priority']) => {
    if (!ticket || !user) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ priority: newPriority })
        .eq('id', ticket.id);

      if (error) throw error;

      setTicket({ ...ticket, priority: newPriority });
    } catch (error) {
      console.error('Error updating ticket priority:', error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !user || !newComment.trim()) return;

    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([
          {
            ticket_id: ticket.id,
            author_id: user.id,
            body: newComment,
            is_private: isPrivate,
            org_id: ticket.org_id,
          },
        ])
        .select(`
          *,
          author:profiles!comments_author_id_fkey (
            display_name,
            email,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      if (data) {
        const typedComment: Comment = {
          ...data,
          author: data.author as Profile,
        };
        setComments([...comments, typedComment]);
        setNewComment('');
        setIsPrivate(false);
      }
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Box className="min-h-screen bg-[#1C1C1C] flex items-center justify-center">
        <Stack align="center" gap="md">
          <IconLock size={48} className="text-gray-400" />
          <Text size="lg" className="text-gray-400">Please log in to view ticket details</Text>
          <Button 
            variant="light" 
            color="blue" 
            onClick={() => router.push('/auth/login')}
          >
            Log In
          </Button>
        </Stack>
      </Box>
    );
  }
  
  if (loading) {
    return (
      <Box className="min-h-screen bg-[#1C1C1C] flex items-center justify-center">
        <Stack align="center" gap="md">
          <Loader color="blue" size="lg" />
          <Text size="sm" c="dimmed">Loading ticket details...</Text>
        </Stack>
      </Box>
    );
  }
  
  if (!ticket) {
    return (
      <Box className="min-h-screen bg-[#1C1C1C] flex items-center justify-center">
        <Stack align="center" gap="md">
          <IconAlertCircle size={48} className="text-gray-400" />
          <Text size="lg" className="text-gray-400">Ticket not found</Text>
          <Button 
            variant="light" 
            color="blue" 
            onClick={() => router.push('/tickets')}
            leftSection={<IconArrowLeft size={16} />}
          >
            Back to Tickets
          </Button>
        </Stack>
      </Box>
    );
  }

  const canUpdateTicket = role === 'agent' || role === 'admin';
  const isCustomer = role === 'customer';

  return (
    <Box className="min-h-screen bg-[#1C1C1C] text-white">
      {/* Header */}
      <Paper className="p-6 rounded-none border-b border-gray-800 bg-[#1C1C1C]">
        <Container size="xl">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Group gap="xl">
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => router.push('/tickets')}
                  className="hover:bg-gray-800 -ml-3"
                >
                  Back to Tickets
                </Button>
                <Badge 
                  variant="filled" 
                  color={statusColors[ticket.status]}
                  size="lg"
                  radius="xl"
                  leftSection={<StatusIcon status={ticket.status} />}
                  className="capitalize"
                >
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </Group>
              <Group>
                <Tooltip label={isStarred ? "Remove from favorites" : "Add to favorites"}>
                  <ActionIcon
                    variant="subtle"
                    color={isStarred ? "yellow" : "gray"}
                    onClick={() => setIsStarred(!isStarred)}
                    className="hover:bg-gray-800 h-[36px] w-[36px]"
                    size="lg"
                  >
                    <IconStar size={20} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={isSubscribed ? "Unsubscribe from notifications" : "Subscribe to notifications"}>
                  <ActionIcon
                    variant="subtle"
                    color={isSubscribed ? "blue" : "gray"}
                    onClick={() => setIsSubscribed(!isSubscribed)}
                    className="hover:bg-gray-800 h-[36px] w-[36px]"
                    size="lg"
                  >
                    {isSubscribed ? <IconBell size={20} /> : <IconBellOff size={20} />}
                  </ActionIcon>
                </Tooltip>
                <Menu position="bottom-end" shadow="md">
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      className="hover:bg-gray-800 h-[36px] w-[36px]"
                      size="lg"
                    >
                      <IconDotsVertical size={20} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown className="bg-[#2C2C2C] border-gray-700">
                    <Menu.Item
                      leftSection={<IconShare size={14} />}
                      className="text-gray-200 hover:bg-[#404040]"
                    >
                      Share ticket
                    </Menu.Item>
                    {canUpdateTicket && (
                      <>
                        <Menu.Item
                          leftSection={<IconEdit size={14} />}
                          className="text-gray-200 hover:bg-[#404040]"
                        >
                          Edit ticket
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          className="text-red-500 hover:bg-[#404040]"
                        >
                          Delete ticket
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>

            <Stack gap="xs">
              <Text size="xl" fw={600} className="text-gray-100">
                {ticket.subject}
              </Text>
              <Group gap="xl">
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="light" color="gray">
                    <IconUser size={12} />
                  </ThemeIcon>
                  <Text size="sm" className="text-gray-400">
                    Opened by {ticket.customer?.display_name || 'Unknown'}
                  </Text>
                </Group>
                {ticket.organization?.name && (
                  <Group gap="xs">
                    <ThemeIcon size="sm" variant="light" color="gray">
                      <IconBuilding size={12} />
                    </ThemeIcon>
                    <Text size="sm" className="text-gray-400">
                      {ticket.organization.name}
                    </Text>
                  </Group>
                )}
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="light" color="gray">
                    <IconCalendar size={12} />
                  </ThemeIcon>
                  <Text size="sm" className="text-gray-400">
                    {format(new Date(ticket.created_at), 'PPp')}
                  </Text>
                </Group>
              </Group>
            </Stack>
          </Stack>
        </Container>
      </Paper>

      <Container size="xl" className="py-6">
        <Grid gutter="md">
          <Grid.Col span={8}>
            {/* Ticket Description */}
            <Paper className="p-6 rounded-lg border border-gray-800 bg-[#1C1C1C] mb-6">
              <Stack gap="md">
                <Group gap="sm">
                  <Avatar
                    src={ticket.customer?.avatar_url}
                    size="lg"
                    radius="xl"
                    color="blue"
                  >
                    {ticket.customer?.display_name?.[0] || '?'}
                  </Avatar>
                  <div>
                    <Text size="sm" fw={500} className="text-gray-100">
                      {ticket.customer?.display_name || 'Unknown'}
                    </Text>
                    <Text size="xs" className="text-gray-400">
                      {ticket.customer?.email}
                    </Text>
                  </div>
                </Group>
                <Text className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {ticket.description}
                </Text>
              </Stack>
            </Paper>

            {/* Comments */}
            <Stack gap="md">
              <Text fw={500} size="lg" className="text-gray-100">
                Comments ({comments.length})
              </Text>
              
              {comments.map((comment) => (
                <Paper
                  key={comment.id}
                  className="p-6 rounded-lg border border-gray-800 bg-[#1C1C1C]"
                >
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="sm">
                        <Avatar
                          src={comment.author?.avatar_url}
                          size="md"
                          radius="xl"
                          color="blue"
                        >
                          {comment.author?.display_name?.[0] || '?'}
                        </Avatar>
                        <div>
                          <Text size="sm" fw={500} className="text-gray-100">
                            {comment.author?.display_name || 'Unknown'}
                          </Text>
                          <Text size="xs" className="text-gray-400">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </Text>
                        </div>
                      </Group>
                      {comment.is_private && (
                        <Badge
                          variant="dot"
                          color="yellow"
                          size="sm"
                          radius="xl"
                        >
                          Internal Note
                        </Badge>
                      )}
                    </Group>
                    <Text className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {comment.body}
                    </Text>
                  </Stack>
                </Paper>
              ))}

              {/* New Comment Form */}
              <Paper className="p-6 rounded-lg border border-gray-800 bg-[#1C1C1C]">
                <form onSubmit={handleSubmitComment}>
                  <Stack gap="md">
                    <Textarea
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      minRows={3}
                      maxRows={10}
                      autosize
                      styles={{
                        input: {
                          background: '#2C2C2C',
                          borderColor: '#404040',
                          color: 'white',
                          '&::placeholder': { color: '#808080' },
                          '&:focus': { 
                            borderColor: '#4C4C4C',
                            boxShadow: '0 0 0 2px rgba(66, 153, 225, 0.1)' 
                          },
                        },
                      }}
                    />
                    <Group justify="space-between">
                      <Group>
                        <Button
                          variant="subtle"
                          color="gray"
                          leftSection={<IconPaperclip size={16} />}
                          className="hover:bg-gray-800"
                        >
                          Attach Files
                        </Button>
                        {canUpdateTicket && (
                          <Button
                            variant="subtle"
                            color={isPrivate ? "yellow" : "gray"}
                            onClick={() => setIsPrivate(!isPrivate)}
                            className="hover:bg-gray-800"
                            leftSection={isPrivate ? <IconEyePause size={16} /> : <IconMessageCircle size={16} />}
                          >
                            {isPrivate ? 'Internal Note' : 'Public Reply'}
                          </Button>
                        )}
                      </Group>
                      <Button
                        type="submit"
                        disabled={!newComment.trim() || submitting}
                        loading={submitting}
                        leftSection={<IconSend size={16} />}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Send
                      </Button>
                    </Group>
                  </Stack>
                </form>
              </Paper>
            </Stack>
          </Grid.Col>

          <Grid.Col span={4}>
            {/* Ticket Details */}
            <Card className="border border-gray-800 bg-[#1C1C1C]">
              <Stack gap="md">
                <Text fw={500} size="lg" className="text-gray-100">
                  Ticket Details
                </Text>

                <Stack gap="xs">
                  <Text size="sm" fw={500} className="text-gray-400">
                    Status
                  </Text>
                  {canUpdateTicket ? (
                    <Select
                      value={ticket.status}
                      onChange={(value) => {
                        if (value) {
                          handleStatusChange(value as Ticket['status']);
                        }
                      }}
                      data={[
                        { value: 'open', label: 'Open' },
                        { value: 'pending', label: 'Pending' },
                        { value: 'on_hold', label: 'On Hold' },
                        { value: 'solved', label: 'Solved' },
                        { value: 'closed', label: 'Closed' },
                      ]}
                      leftSection={<StatusIcon status={ticket.status} />}
                      styles={{
                        input: {
                          background: '#2C2C2C',
                          borderColor: '#404040',
                          color: 'white',
                        },
                        dropdown: {
                          background: '#2C2C2C',
                          borderColor: '#404040',
                        },
                        option: {
                          '&[data-selected]': {
                            background: '#404040',
                          },
                          '&:hover': {
                            background: '#404040',
                          },
                          color: 'white',
                        },
                      }}
                    />
                  ) : (
                    <Badge
                      variant="filled"
                      color={statusColors[ticket.status]}
                      size="lg"
                      radius="xl"
                      leftSection={<StatusIcon status={ticket.status} />}
                      className="capitalize w-fit"
                    >
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                  )}
                </Stack>

                <Stack gap="xs">
                  <Text size="sm" fw={500} className="text-gray-400">
                    Priority
                  </Text>
                  {canUpdateTicket ? (
                    <Select
                      value={ticket.priority}
                      onChange={(value) => {
                        if (value) {
                          handlePriorityChange(value as Ticket['priority']);
                        }
                      }}
                      data={[
                        { value: 'low', label: 'Low' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'high', label: 'High' },
                        { value: 'urgent', label: 'Urgent' },
                      ]}
                      styles={{
                        input: {
                          background: '#2C2C2C',
                          borderColor: '#404040',
                          color: 'white',
                        },
                        dropdown: {
                          background: '#2C2C2C',
                          borderColor: '#404040',
                        },
                        option: {
                          '&[data-selected]': {
                            background: '#404040',
                          },
                          '&:hover': {
                            background: '#404040',
                          },
                          color: 'white',
                        },
                      }}
                    />
                  ) : (
                    <Badge
                      variant="filled"
                      color={priorityColors[ticket.priority]}
                      size="lg"
                      radius="xl"
                      className="capitalize w-fit"
                    >
                      {ticket.priority}
                    </Badge>
                  )}
                </Stack>

                <Divider className="border-gray-800" />

                <Stack gap="xs">
                  <Text size="sm" fw={500} className="text-gray-400">
                    Customer
                  </Text>
                  <Group>
                    <Avatar
                      src={ticket.customer?.avatar_url}
                      size="md"
                      radius="xl"
                      color="blue"
                    >
                      {ticket.customer?.display_name?.[0] || '?'}
                    </Avatar>
                    <Stack gap={2}>
                      <Text size="sm" className="text-gray-200">
                        {ticket.customer?.display_name || 'Unknown'}
                      </Text>
                      <Text size="xs" className="text-gray-400">
                        {ticket.customer?.email}
                      </Text>
                    </Stack>
                  </Group>
                </Stack>

                {ticket.organization?.name && (
                  <Stack gap="xs">
                    <Text size="sm" fw={500} className="text-gray-400">
                      Organization
                    </Text>
                    <Group gap="xs">
                      <ThemeIcon size="sm" variant="light" color="gray">
                        <IconBuilding size={12} />
                      </ThemeIcon>
                      <Text size="sm" className="text-gray-200">
                        {ticket.organization.name}
                      </Text>
                    </Group>
                  </Stack>
                )}

                <Stack gap="xs">
                  <Text size="sm" fw={500} className="text-gray-400">
                    Created
                  </Text>
                  <Group gap="xs">
                    <ThemeIcon size="sm" variant="light" color="gray">
                      <IconCalendar size={12} />
                    </ThemeIcon>
                    <Text size="sm" className="text-gray-200">
                      {format(new Date(ticket.created_at), 'PPp')}
                    </Text>
                  </Group>
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Container>
    </Box>
  );
} 