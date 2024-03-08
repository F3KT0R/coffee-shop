import './App.scss';
import { CartType } from './CartItem';

export type CoffeListing = {
  id?: number;
  notAvailable?: boolean;
  image: string;
  price: number;
  brand: string;
  system: string;
  pods: number;
};

type ItemCardProps = {
  coffeeItem: CoffeListing;
  onCardClick?: (newItem: CartType) => void;
};

export const CardItem = ({ onCardClick, coffeeItem }: ItemCardProps) => {
  const handleCardClick = (
    image: string,
    brand: string,
    system: string,
    id: number,
    price: number
  ) => {
    !!onCardClick &&
      onCardClick({
        image: image,
        brand: brand,
        system: system,
        id: id,
        quantity: 1,
        price: price,
      });
  };

  return (
    <>
      {!coffeeItem.notAvailable ? (
        <div
          className='card'
          onClick={() =>
            !!coffeeItem.id &&
            handleCardClick(
              coffeeItem.image,
              coffeeItem.brand,
              coffeeItem.system,
              coffeeItem.id,
              coffeeItem.price
            )
          }
        >
          <h4 className='card__brand'>
            #{coffeeItem.id} - {coffeeItem.brand}
          </h4>
          <img
            loading='lazy'
            src={coffeeItem.image}
            alt={coffeeItem.brand}
            className='card__image'
          />
          <h2 className='card__price'>
            {coffeeItem.price} din / {coffeeItem.pods} kapsula
          </h2>
          <h4>
            Za <span className='card__system'>{coffeeItem.system}</span> aparate
          </h4>
        </div>
      ) : (
        ''
      )}
    </>
  );
};
