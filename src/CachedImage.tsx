import { useEffect, useState } from 'react';
import localForage from 'localforage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

type CachedImageProp = {
  imageUrl: string;
};

export const CachedImage = ({ imageUrl }: CachedImageProp) => {
  const [cachedImage, setCachedImage] = useState<string | null>(null);

  useEffect(() => {
    const cacheImage = async () => {
      try {
        // Check if the image is already cached
        const cachedImageData = await localForage.getItem<string>(imageUrl);

        if (cachedImageData) {
          setCachedImage(cachedImageData);
        } else {
          // Fetch the image
          const response = await fetch(imageUrl);

          // Convert the response to a data URL
          const blob = await response.blob();
          const dataUrl = await blobToDataURL(blob);

          // Cache the data URL using localForage
          await localForage.setItem<string>(imageUrl, dataUrl);

          setCachedImage(dataUrl);
        }
      } catch (error) {
        console.error('Error caching image:', error);
      }
    };

    cacheImage();
  }, [imageUrl]);

  const blobToDataURL = async (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  };

  return (
    <div>
      {cachedImage ? (
        <img
          loading='lazy'
          src={cachedImage}
          alt='Cached Image'
          className='card__image'
        />
      ) : (
        <FontAwesomeIcon className='card__loading' icon={faSpinner} />
      )}
    </div>
  );
};
