export const getPriorityColor = (
	priority: 'low' | 'medium' | 'high' | 'urgent'
) => {
	switch (priority) {
		case 'low':
			return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
		case 'medium':
			return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
		case 'high':
			return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
		case 'urgent':
			return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
		default:
			return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
	}
};

export const formatDate = (dateString: string) => {
	if (!dateString) return '';
	return new Date(dateString).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};
