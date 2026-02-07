import React from 'react';
import { Link } from 'react-router-dom';
import brandImgUrl from '@/assets/banner-blue.png';

interface LogoBadgeProps {
  size?: string;
  linkTo?: string;
}

const LogoBadge: React.FC<LogoBadgeProps> = ({
  size = '1em',
  linkTo = '/',
}) => (
  <Link
    to={linkTo}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      textDecoration: 'none',
      fontSize: size,
    }}
  >
    <img
      src={brandImgUrl}
      alt="ACM@UIUC Logo"
      style={{
        height: '2.5em',
        width: 'auto',
      }}
    />
    <span
      style={{
        fontWeight: 600,
        fontSize: '1.25em',
        color: '#1b335c', 
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <span style={{ color: '#0053B3' }}>Print Queue</span>
    </span>
  </Link>
);

export default LogoBadge;