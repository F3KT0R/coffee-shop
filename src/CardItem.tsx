import { types } from './App';
import './App.scss';
import { CartType } from './CartItem';

export type CoffeListing = {
  id?: number;
  notAvailable?: boolean;
  image: string;
  price: number;
  brand: string;
  system: string;
  pods?: number;
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

  const roundToNearestTen = (num: number): number => {
    return Math.round(num / 10) * 10;
  };

  const calculatePrice = (
    ogPrice: number,
    pods: number | string = '',
    type: string
  ): number => {
    if (type == 'syrup') {
      if (ogPrice < 5) {
        return roundToNearestTen(ogPrice * 350);
      } else {
        return roundToNearestTen(ogPrice * 280);
      }
    }
    if (pods == '') return roundToNearestTen(ogPrice * 237);

    return roundToNearestTen(
      ogPrice * 140 + parseInt(pods.toString()) * 16 * 1.5
    );
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
            alt='Cached Image'
            className='card__image'
          />
          <h2 className='card__price'>
            {calculatePrice(
              coffeeItem.price,
              coffeeItem.pods,
              coffeeItem.system
            )}{' '}
            din
            <span>
              {coffeeItem.pods ? ' / ' + coffeeItem.pods + ' kapsula' : ''}
            </span>
          </h2>
          <h4>
            Za{' '}
            <span className='card__system'>
              {types.map((type) => {
                if (type.type == coffeeItem.system) return type.name;
              })}
            </span>{' '}
            aparate
          </h4>
        </div>
      ) : (
        ''
      )}
    </>
  );
};
