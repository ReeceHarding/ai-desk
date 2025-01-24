interface Props {
  status: string;
  customerSideSolved?: boolean;
}

export default function TicketStatusBadge({ status, customerSideSolved }: Props) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'solved':
      case 'closed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'on_hold':
        return 'bg-orange-100 text-orange-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <span
        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
          status
        )}`}
      >
        {status}
      </span>
      {customerSideSolved && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Marked Solved
        </span>
      )}
    </div>
  );
} 