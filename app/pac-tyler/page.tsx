"use client";

import { useEffect } from "react";

export default function PacTyler() {
  useEffect(() => {
    // Redirect to the static HTML file
    window.location.href = "/pac-tyler.html";
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#E3B800'
    }}>
      <p>Redirecting to Pac-Tyler...</p>
    </div>
  );
}
