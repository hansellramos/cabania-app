export async function fetchUsersByOrganization(orgId) {
  const response = await fetch(`/api/organizations/${orgId}/users`);
  if (!response.ok) {
    throw new Error('Error fetching users');
  }
  return response.json();
}

export async function removeUserFromOrganization(orgId, userId) {
  const response = await fetch(`/api/organizations/${orgId}/users/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al remover usuario');
  }
  return response.json();
}
