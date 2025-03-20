import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

type ButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  textClassName?: string;
};

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  className = '',
  textClassName = '',
}) => {
  const variantClasses = {
    primary: 'bg-blue-500',
    secondary: 'bg-gray-200',
    outline: 'bg-transparent border border-blue-500',
  };

  const textVariantClasses = {
    primary: 'text-white',
    secondary: 'text-gray-800',
    outline: 'text-blue-500',
  };

  const sizeClasses = {
    small: 'py-1 px-3',
    medium: 'py-2 px-4',
    large: 'py-3 px-6',
  };

  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`items-center justify-center rounded-md ${variantClasses[variant]} ${sizeClasses[size]} ${
        disabled ? 'opacity-50' : ''
      } ${className}`}>
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'outline' ? '#3b82f6' : '#ffffff'} />
      ) : (
        <Text
          className={`font-medium ${textVariantClasses[variant]} ${textSizeClasses[size]} ${textClassName}`}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};
