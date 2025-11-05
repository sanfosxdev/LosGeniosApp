import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getUsersFromCache, addUser, updateUser, deleteUser } from '../../services/userService';
import type { User } from '../../types';
import { UserRole } from '../../types';
import Pagination from './Pagination';
import { PlusIcon } from '../icons/PlusIcon';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { UsersIcon } from '../icons/UsersIcon';
import AddEditUserModal from './AddEditUserModal';
import DeleteUserConfirmationModal from './DeleteUserConfirmationModal';
import { toastService } from '../../services/toastService';
import { Spinner } from './Spinner';

const ITEMS_PER_PAGE = 10;

interface UsersPanelProps {
  dataTimestamp: number;
}

const UsersPanel: React.FC<UsersPanelProps> = ({ dataTimestamp }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<{ type: string; id: string | null } | null>(null);

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = useCallback(() => {
    setUsers(getUsersFromCache());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchUsers();
  }, [dataTimestamp, fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setIsAddEditModalOpen(true);
  };

  const handleOpenDeleteModal = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsAddEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setEditingUser(null);
    setUserToDelete(null);
  };

  const handleSaveUser = async (userData: Omit<User, 'id' | 'createdAt' | 'lastAccess'> & { id?: string }) => {
    const isEditing = !!userData.id;
    const actionType = isEditing ? 'edit' : 'add';
    setLoadingAction({ type: actionType, id: userData.id || null });
    
    try {
      if (isEditing) {
        await updateUser(userData as User);
        toastService.show('Usuario actualizado con éxito.', 'success');
      } else {
        await addUser(userData);
        toastService.show('Usuario agregado con éxito.', 'success');
      }
      handleCloseModals();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar el usuario.';
      toastService.show(message, 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (userToDelete) {
      setLoadingAction({ type: 'delete', id: userToDelete.id });
      try {
        await deleteUser(userToDelete.id);
        toastService.show('Usuario eliminado con éxito.', 'success');
        handleCloseModals();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al eliminar el usuario.';
        toastService.show(message, 'error');
      } finally {
        setLoadingAction(null);
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Usuarios del Sistema</h2>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Agregar Usuario
        </button>
      </div>

      {isLoading ? (
        <p className="dark:text-white">Cargando usuarios...</p>
      ) : users.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <UsersIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No hay usuarios registrados</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Comienza agregando tu primer usuario.</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full max-w-lg px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto responsive-table">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Último Acceso</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td data-label="Nombre" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
                    <td data-label="Email" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                    <td data-label="Rol" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === UserRole.ADMIN ? 'bg-primary/20 text-primary' : 'bg-blue-100 text-blue-800'}`}>
                            {user.role}
                        </span>
                    </td>
                    <td data-label="Último Acceso" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.lastAccess ? new Date(user.lastAccess).toLocaleString('es-AR') : 'Nunca'}
                    </td>
                    <td data-label="Acciones" className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      {loadingAction?.id === user.id ? (
                        <div className="flex justify-center items-center"><Spinner /></div>
                      ) : (
                        <div className="flex items-center justify-center space-x-4">
                          <button onClick={() => handleOpenEditModal(user)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300" aria-label={`Editar ${user.name}`}><EditIcon className="w-5 h-5" /></button>
                          <button onClick={() => handleOpenDeleteModal(user)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Eliminar ${user.name}`}><TrashIcon className="w-5 h-5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      <AddEditUserModal
        isOpen={isAddEditModalOpen}
        onClose={handleCloseModals}
        onSave={handleSaveUser}
        userToEdit={editingUser}
        isSaving={loadingAction?.type === 'add' || loadingAction?.type === 'edit'}
      />

      <DeleteUserConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseModals}
        onConfirm={handleConfirmDelete}
        userName={userToDelete?.name || ''}
        isDeleting={loadingAction?.type === 'delete'}
      />
    </div>
  );
};

export default UsersPanel;