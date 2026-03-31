import { useMemo } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

type Props = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
};

export const PaginationControls = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
}: Props) => {
  // Don't render if there's nothing to paginate
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Memoize visible pages logic for performance
  const visiblePages = useMemo(() => {
    const pages: (number | string)[] = [];
    const range = 1; // Number of pages to show around current page

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || // Always show first
        i === totalPages || // Always show last
        (i >= currentPage - range && i <= currentPage + range) // Show around current
      ) {
        pages.push(i);
      } else if (i === currentPage - range - 1 || i === currentPage + range + 1) {
        pages.push("...");
      }
    }
    // Filter out consecutive ellipses
    return pages.filter((item, index) => item !== "..." || pages[index - 1] !== "...");
  }, [currentPage, totalPages]);

  return (
    <nav 
      aria-label="Pagination"
      className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full py-3"
    >
      {/* Result Summary */}
      <div className="text-sm text-slate-500 dark:text-slate-400 order-2 sm:order-1">
        Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{startItem}</span>
        {" "}-{" "}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{endItem}</span> 
        {" "}of{" "}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{totalItems}</span> 
        {" "}{itemLabel}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 order-1 sm:order-2">
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
          aria-label="Go to previous page"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Desktop Page Numbers */}
        <div className="hidden sm:flex items-center gap-1.5">
          {visiblePages.map((page, index) => {
            if (page === "...") {
              return (
                <div key={`ellipsis-${index}`} className="flex items-center justify-center w-8 text-slate-400">
                  <MoreHorizontal size={16} strokeWidth={1.5} />
                </div>
              );
            }

            const isActive = currentPage === page;

            return (
              <button
                key={`page-${page}`}
                onClick={() => onPageChange(page as number)}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Page ${page}`}
                className={`
                  min-w-[2.25rem] h-9 px-3 rounded-md text-sm font-medium transition-all
                  ${isActive 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  }
                `}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Mobile Indicator */}
        <span className="sm:hidden text-sm font-medium text-slate-700 dark:text-slate-300 px-2">
          Page {currentPage} of {totalPages}
        </span>

        {/* Next Button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
          aria-label="Go to next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </nav>
  );
};
