import React from 'react';
import './LoadingSkeleton.scss';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="loading-skeleton">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="skeleton-card">
          <div className="skeleton-image shimmer"></div>
          <div className="skeleton-content">
            <div className="skeleton-line short shimmer"></div>
            <div className="skeleton-line shimmer"></div>
            <div className="skeleton-line medium shimmer"></div>
            <div className="skeleton-button shimmer"></div>
          </div>
        </div>
      ))}
    </div>
  );
};
