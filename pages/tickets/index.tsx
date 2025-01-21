import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { 
  Button, 
  Table,
  Text,
  Group,
  Badge,
  ActionIcon,
  Box,
  Menu,
  Tooltip,
  SegmentedControl,
  TextInput,
  Transition,
  Select,
  Paper,
  Loader,
  Chip,
  Avatar,
  Drawer,
  ScrollArea,
  Container,
  Stack,
  Skeleton,
  Flex,
} from '@mantine/core';
import { useUserRole } from '@/hooks/useUserRole';
import { formatDistanceToNow } from 'date-fns';
import { 
  IconDotsVertical, 
  IconStar, 
  IconMoon, 
  IconInbox, 
  IconPhoto,
  IconSearch,
  IconFilter,
  IconAdjustments,
  IconChevronDown,
  IconX,
  IconClock,
  IconAlertCircle,
  IconCheck,
  IconEyePause,
  IconLock,
  IconPlus,
} from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';

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

export default function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();
  const { role, loading: roleLoading } = useUserRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState('list');
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    async function fetchTickets() {
      if (!user) return;

      const query = supabase
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
        .is('deleted_at', null);

      if (role === 'customer') {
        query.eq('customer_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        return;
      }

      if (data) {
        const typedTickets: Ticket[] = data.map(ticket => ({
          ...ticket,
          customer: ticket.customer as Profile,
          organization: ticket.organization as Organization,
        }));
        setTickets(typedTickets);
      }
      setLoading(false);
    }

    if (!roleLoading) {
      fetchTickets();
    }
  }, [user, supabase, role, roleLoading]);

  const filteredTickets = tickets
    .filter(ticket => 
      (searchQuery === '' || 
        ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.customer?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.customer?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      ) &&
      (statusFilter.length === 0 || statusFilter.includes(ticket.status)) &&
      (priorityFilter.length === 0 || priorityFilter.includes(ticket.priority))
    )
    .sort((a, b) => {
      const aValue = a[sortBy as keyof Ticket];
      const bValue = b[sortBy as keyof Ticket];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortOrder === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }
      
      return 0;
    });

  if (roleLoading) {
    return (
      <Box className="min-h-screen bg-[#1C1C1C] flex items-center justify-center">
        <Stack align="center" gap="md">
          <Loader color="blue" size="lg" />
          <Text size="sm" c="dimmed">Loading tickets...</Text>
        </Stack>
      </Box>
    );
  }
  
  if (!user) {
    return (
      <Box className="min-h-screen bg-[#1C1C1C] flex items-center justify-center">
        <Stack align="center" gap="md">
          <IconLock size={48} className="text-gray-400" />
          <Text size="lg" className="text-gray-400">Please log in to view tickets</Text>
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

  return (
    <Box className="min-h-screen bg-[#1C1C1C] text-white">
      {/* Header */}
      <Paper className="p-6 rounded-none border-b border-gray-800 bg-[#1C1C1C]">
        <Container size="xl">
          <Group justify="space-between" align="center">
            <Group>
              <Stack gap={4}>
                <Group align="center" gap="xs">
                  <Text size="xl" fw={600}>Tickets</Text>
                  <Badge 
                    variant="filled" 
                    color="blue" 
                    size="lg" 
                    radius="sm"
                    className="bg-blue-600"
                  >
                    {tickets.length} Total
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">Manage and track support requests</Text>
              </Stack>
            </Group>
            <Group>
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconFilter size={16} />}
                onClick={() => setFilterOpen(!filterOpen)}
                className="hover:bg-gray-800"
              >
                Filters
              </Button>
              <Button
                onClick={() => router.push('/tickets/new')}
                variant="filled"
                color="blue"
                leftSection={<IconPlus size={16} />}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create New Ticket
              </Button>
            </Group>
          </Group>
        </Container>
      </Paper>

      {/* Search and Filters */}
      <Paper className="border-b border-gray-800 bg-[#1C1C1C]">
        <Container size="xl">
          <Box className="py-6">
            <Group justify="space-between" align="center">
              <TextInput
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={<IconSearch size={16} className="text-gray-400" />}
                className="w-96"
                styles={{
                  input: {
                    background: '#2C2C2C',
                    borderColor: '#404040',
                    color: 'white',
                    height: '42px',
                    '&::placeholder': { color: '#808080' },
                    '&:focus': { 
                      borderColor: '#4C4C4C',
                      boxShadow: '0 0 0 2px rgba(66, 153, 225, 0.1)' 
                    },
                  },
                }}
              />
              <Group>
                <Select
                  placeholder="Sort by"
                  value={sortBy}
                  onChange={(value) => value && setSortBy(value)}
                  data={[
                    { value: 'created_at', label: 'Created Date' },
                    { value: 'updated_at', label: 'Updated Date' },
                    { value: 'priority', label: 'Priority' },
                    { value: 'status', label: 'Status' },
                  ]}
                  styles={{
                    input: {
                      background: '#2C2C2C',
                      borderColor: '#404040',
                      color: 'white',
                      height: '42px',
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
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
                  className="hover:bg-gray-800 h-[42px] w-[42px]"
                >
                  <IconChevronDown
                    size={18}
                    style={{
                      transform: `rotate(${sortOrder === 'asc' ? 180 : 0}deg)`,
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </ActionIcon>
              </Group>
            </Group>

            <Transition mounted={filterOpen} transition="slide-down" duration={200}>
              {(styles) => (
                <Box style={styles} className="mt-6">
                  <Stack gap="md">
                    <Group>
                      <Text size="sm" fw={500} className="text-gray-400 w-20">Status:</Text>
                      <Chip.Group multiple value={statusFilter} onChange={setStatusFilter}>
                        <Group>
                          {['open', 'pending', 'on_hold', 'solved', 'closed'].map((status) => (
                            <Chip
                              key={status}
                              value={status}
                              variant="filled"
                              size="sm"
                              radius="xl"
                              styles={{
                                label: {
                                  background: statusFilter.includes(status) ? `var(--mantine-color-${statusColors[status]}-filled)` : '#2C2C2C',
                                  color: 'white',
                                  padding: '6px 12px',
                                  height: '32px',
                                  '&:hover': {
                                    background: statusFilter.includes(status) ? `var(--mantine-color-${statusColors[status]}-filled)` : '#404040',
                                  },
                                },
                              }}
                            >
                              <Group gap={6}>
                                <StatusIcon status={status} />
                                <span className="capitalize">{status.replace('_', ' ')}</span>
                              </Group>
                            </Chip>
                          ))}
                        </Group>
                      </Chip.Group>
                    </Group>

                    <Group>
                      <Text size="sm" fw={500} className="text-gray-400 w-20">Priority:</Text>
                      <Chip.Group multiple value={priorityFilter} onChange={setPriorityFilter}>
                        <Group>
                          {['low', 'medium', 'high', 'urgent'].map((priority) => (
                            <Chip
                              key={priority}
                              value={priority}
                              variant="filled"
                              size="sm"
                              radius="xl"
                              styles={{
                                label: {
                                  background: priorityFilter.includes(priority) ? `var(--mantine-color-${priorityColors[priority]}-filled)` : '#2C2C2C',
                                  color: 'white',
                                  padding: '6px 12px',
                                  height: '32px',
                                  '&:hover': {
                                    background: priorityFilter.includes(priority) ? `var(--mantine-color-${priorityColors[priority]}-filled)` : '#404040',
                                  },
                                },
                              }}
                            >
                              <span className="capitalize">{priority}</span>
                            </Chip>
                          ))}
                        </Group>
                      </Chip.Group>
                    </Group>
                  </Stack>
                </Box>
              )}
            </Transition>
          </Box>
        </Container>
      </Paper>

      {/* Tickets List */}
      <Container size="xl" className="py-6">
        <Paper className="rounded-lg overflow-hidden border border-gray-800">
          <ScrollArea className="h-[calc(100vh-380px)]" type="scroll">
            <Table highlightOnHover className="bg-[#1C1C1C]">
              <Table.Thead className="bg-[#2C2C2C] sticky top-0">
                <Table.Tr>
                  <Table.Th>Subject</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Priority</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Skeleton height={40} radius="sm" />
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={24} width={80} radius="xl" />
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={24} width={60} radius="xl" />
                      </Table.Td>
                      <Table.Td>
                        <Group gap="sm">
                          <Skeleton height={32} width={32} radius="xl" />
                          <div>
                            <Skeleton height={16} width={120} radius="sm" mb={4} />
                            <Skeleton height={12} width={160} radius="sm" />
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={16} width={100} radius="sm" />
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={32} width={32} radius="sm" />
                      </Table.Td>
                    </Table.Tr>
                  ))
                ) : filteredTickets.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Stack align="center" className="py-12">
                        <IconInbox size={48} className="text-gray-400" />
                        <Text size="lg" className="text-gray-400">No tickets found</Text>
                        <Text size="sm" c="dimmed">Try adjusting your search or filters</Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <Table.Tr
                      key={ticket.id}
                      className="cursor-pointer hover:bg-[#2C2C2C] transition-colors duration-150"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <Table.Td>
                        <Group>
                          <Stack gap={4}>
                            <Text size="sm" fw={500} className="text-gray-100">
                              {ticket.subject}
                            </Text>
                            {ticket.organization?.name && (
                              <Text size="xs" className="text-gray-400">
                                {ticket.organization.name}
                              </Text>
                            )}
                          </Stack>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="filled"
                          color={statusColors[ticket.status]}
                          size="sm"
                          radius="xl"
                          leftSection={<StatusIcon status={ticket.status} />}
                          styles={{
                            root: {
                              textTransform: 'capitalize',
                              padding: '0 12px',
                            },
                          }}
                        >
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="filled"
                          color={priorityColors[ticket.priority]}
                          size="sm"
                          radius="xl"
                          styles={{
                            root: {
                              textTransform: 'capitalize',
                              padding: '0 12px',
                            },
                          }}
                        >
                          {ticket.priority}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar
                            src={ticket.customer?.avatar_url}
                            size="md"
                            radius="xl"
                            color="blue"
                          >
                            {ticket.customer?.display_name?.[0] || '?'}
                          </Avatar>
                          <Stack gap={2}>
                            <Text size="sm" className="text-gray-100">
                              {ticket.customer?.display_name || 'Unknown'}
                            </Text>
                            <Text size="xs" className="text-gray-400">
                              {ticket.customer?.email}
                            </Text>
                          </Stack>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" className="text-gray-400">
                          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Menu shadow="md" width={200} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTicket(selectedTicket === ticket.id ? null : ticket.id);
                              }}
                              className="hover:bg-gray-700"
                            >
                              <IconDotsVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>

                          <Menu.Dropdown
                            className="bg-[#2C2C2C] border-gray-700"
                          >
                            <Menu.Item
                              leftSection={<IconStar size={14} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                // Add to favorites logic
                              }}
                              className="text-gray-200 hover:bg-[#404040]"
                            >
                              Add to favorites
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconMoon size={14} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                // Snooze notification logic
                              }}
                              className="text-gray-200 hover:bg-[#404040]"
                            >
                              Snooze notifications
                            </Menu.Item>
                            {role === 'agent' || role === 'admin' ? (
                              <Menu.Item
                                color="red"
                                leftSection={<IconX size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Archive ticket logic
                                }}
                                className="text-red-500 hover:bg-[#404040]"
                              >
                                Archive ticket
                              </Menu.Item>
                            ) : null}
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      </Container>
    </Box>
  );
} 