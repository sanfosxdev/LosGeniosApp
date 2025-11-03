import React from 'react';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}) => {
  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      if (currentPage > 4) {
        pageNumbers.push('...');
      }
      
      let startPage = Math.max(2, currentPage - 2);
      let endPage = Math.min(totalPages - 1, currentPage + 2);

      if (currentPage <= 3) {
        endPage = 5;
      }
      if (currentPage >= totalPages - 2) {
        startPage = totalPages - 4;
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      if (currentPage < totalPages - 3) {
        pageNumbers.push('...');
      }
      pageNumbers.push(totalPages);
    }
    return pageNumbers;
  };

  const pageNumbers = getPageNumbers();
  const commonButtonClasses = "px-3 py-2 leading-tight border transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  const activeClasses = "bg-primary text-white border-primary";
  const inactiveClasses = "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-white";

  if (totalPages <= 1 && !disabled) {
    return null;
  }

  return (
    <nav className="mt-6" aria-label="Pagination">
      <ul className="inline-flex items-center -space-x-px text-sm">
        <li>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1 || disabled}
            className={`${commonButtonClasses} rounded-l-lg ${inactiveClasses}`}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
        </li>
        {pageNumbers.map((page, index) => (
          <li key={index}>
            {typeof page === 'number' ? (
              <button
                onClick={() => onPageChange(page)}
                disabled={disabled}
                className={`${commonButtonClasses} ${currentPage === page ? activeClasses : inactiveClasses}`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            ) : (
              <span className={`${commonButtonClasses} bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600`}>
                {page}
              </span>
            )}
          </li>
        ))}
        <li>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || disabled}
            className={`${commonButtonClasses} rounded-r-lg ${inactiveClasses}`}
            aria-label="Next page"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;