import React from 'react';
import { Radiation } from 'lucide-react';

export interface PermitTypeIconProps {
  icon?: string;
  type?: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

/**
 * Renders permit category / type icons.
 * Specifically uses lucide-react Radiation icon for RAD (radiography / radiation NDT)
 * to avoid broken ligatures in Material Symbols font, and standard Material Symbols for other types.
 */
export const PermitTypeIcon: React.FC<PermitTypeIconProps> = ({
  icon,
  type,
  className = '',
  size = 16,
  style
}) => {
  const isRad =
    type === 'RAD' ||
    type === 'RADI' ||
    type === 'RADIOGRAPHY' ||
    icon === 'radiation' ||
    icon === 'radioactive';

  if (isRad) {
    return (
      <Radiation
        size={size}
        className={`inline-block shrink-0 ${className}`}
        style={style}
      />
    );
  }

  return (
    <span
      className={`material-symbols-outlined shrink-0 ${className}`}
      style={{ fontSize: `${size}px`, ...style }}
    >
      {icon || 'description'}
    </span>
  );
};

export default PermitTypeIcon;
