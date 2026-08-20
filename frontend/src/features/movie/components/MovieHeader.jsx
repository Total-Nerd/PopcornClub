import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Star, Clock, Calendar } from 'lucide-react';
import { useMovieStore } from '../store/useMovieStore';
import ReactionPicker from '../../../components/ReactionPicker';

const MovieHeader = ({ scrollY, onEditPoster, onEditBackdrop, children }) => {
  const navigate = useNavigate();
  const { movieDetails } = useMovieStore();

  if (!movieDetails) return null;

  return (
    <>
      {/* Backdrop Area */}
      <div className="details-backdrop-bg">
        <div
          className="details-backdrop-image"
          style={{
            backgroundImage: movieDetails.backdrop_path ? `url(https://image.tmdb.org/t/p/w1280${movieDetails.backdrop_path})` : 'none',
            filter: `blur(${Math.min(10, scrollY / 30)}px)`,
            transform: `scale(${1 + Math.min(10, scrollY / 30) / 100})`
          }}
        />
        <div
          className="details-backdrop-overlay"
          style={{
            opacity: Math.min(0.8, scrollY / 250)
          }}
        />
        <div className="details-backdrop-gradient" />
      </div>

      <div className="details-banner-spacer">
        <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)', backdropFilter: 'blur(8px)', background: 'var(--bg-card)' }}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>

        <button
          className="edit-backdrop-btn"
          onClick={onEditBackdrop}
        >
          <Edit size={16} />
          <span>Change Backdrop</span>
        </button>
      </div>

      {/* Content Layout */}
      <div className="details-content-wrapper">
        <div className="details-layout">
          {/* Left Column: Poster */}
          <div className="details-left-col">
            <div
              className="details-poster-container"
              onClick={onEditPoster}
            >
              <div className="details-poster-card">
                {movieDetails.poster_path ? (
                  <img src={`https://image.tmdb.org/t/p/w500${movieDetails.poster_path}`} alt={movieDetails.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '330px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No Cover
                  </div>
                )}
              </div>

              <div className="details-poster-edit-overlay">
                <Edit size={24} />
                <span>Change Poster</span>
              </div>
            </div>
          </div>

          {/* Right Column: Metadata */}
          <div className="details-right-col">
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', lineHeight: '1.2' }}>{movieDetails.title}</h1>
            {movieDetails.tagline && (
              <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '1.1rem' }}>"{movieDetails.tagline}"</p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24' }}>
                <Star size={18} fill="#fbbf24" />
                <span style={{ fontWeight: '600', fontSize: '1rem' }}>{movieDetails.vote_average?.toFixed(1) || '0.0'}</span>
              </div>

              {movieDetails.runtime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <Clock size={16} />
                  <span>{movieDetails.runtime} min</span>
                </div>
              )}

              {movieDetails.release_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <Calendar size={16} />
                  <span>{new Date(movieDetails.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              )}
            </div>

            {/* Genres */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {movieDetails.genres?.map(g => (
                <span key={g.id} style={{ padding: '6px 14px', background: 'var(--overlay-subtle)', borderRadius: '16px', fontSize: '0.8rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: '500' }}>
                  {g.name}
                </span>
              ))}
            </div>

            <div>
              <ReactionPicker mediaId={movieDetails.id} mediaType="movie" />
            </div>

            {/* Action buttons provided by parent */}
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default MovieHeader;
