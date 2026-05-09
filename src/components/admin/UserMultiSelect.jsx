import React, { useState, useEffect } from 'react';
import Select from 'react-select';

const UserMultiSelect = ({ value, onChange, token }) => {
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/admin/users', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          const users = data.users || [];
          setOptions(users.map(user => ({
            value: user._id,
            label: `${user.name} (${user.email})`
          })));
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchUsers();
    }
  }, [token]);

  return (
    <Select
      isMulti
      isLoading={isLoading}
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Mở danh sách để chọn hoặc gõ tên để tìm..."
      noOptionsMessage={() => "Không có dữ liệu"}
      styles={{
        control: (base) => ({
          ...base,
          borderColor: '#dce6f2',
          padding: '2px',
          borderRadius: '6px',
        })
      }}
    />
  );
};

export default UserMultiSelect;
