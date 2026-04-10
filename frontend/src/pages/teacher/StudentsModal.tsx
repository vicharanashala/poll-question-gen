import { useState } from 'react';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users } from 'lucide-react';

export type ModalStudent = {
  firstName: string;
  email: string;
};

type ShowStudentsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  students: ModalStudent[];
};

const ShowStudentsModal = ({ isOpen, onClose, students }: ShowStudentsModalProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(students.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentStudents = students.slice(startIndex, startIndex + itemsPerPage);

  const handlePrev = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNext = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Students List
            </DialogTitle>
            {/* <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
            >
              <X size={20} />
            </Button> */}
          </div>
        </DialogHeader>
        <CardContent className="flex-1 pt-0 overflow-y-auto">
          <div className="space-y-3">
            {currentStudents.map((student: ModalStudent, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{student.firstName}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs truncate">{student.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-900/90">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrev}
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                className="border-purple-500 text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-400 dark:text-purple-300 dark:hover:bg-purple-900/30 text-xs"
              >
                Previous
              </Button>
              <Button
                onClick={handleNext}
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                className="border-purple-500 text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-400 dark:text-purple-300 dark:hover:bg-purple-900/30 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShowStudentsModal;