import React from 'react'

type Source = {
  srcSet: string
  media?: string
  type?: string
}

type ResponsiveImageProps = {
  alt: string
  fallbackSrc: string
  sources?: Source[]
  className?: string
  width?: number
  height?: number
}

const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  alt,
  fallbackSrc,
  sources = [],
  className = '',
  width,
  height,
}) => {
  return (
    <picture className={className}>
      {sources.map((source) => (
        <source
          key={`${source.media ?? 'all'}-${source.type ?? 'any'}`}
          srcSet={source.srcSet}
          media={source.media}
          type={source.type}
        />
      ))}
      <img
        src={fallbackSrc}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </picture>
  )
}

export default ResponsiveImage
