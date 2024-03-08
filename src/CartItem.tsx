import './App.scss';
import { Cart } from './Cart';

export type CartType = {
  id: number;
  image: string;
  price: number;
  brand: string;
  system: string;
  quantity: number;
};

type ItemCardProps = {
  coffeeItem: CartType;
  onCardClick?: (newItem: Cart) => void;
};

export const CartItem = ({ onCardClick, coffeeItem }: ItemCardProps) => {
  const handleCardClick = (
    image: string,
    brand: string | undefined,
    system: string | undefined,
    id: number,
    price: number
  ) => {
    !!onCardClick &&
      onCardClick({
        image: image,
        name: system + ' - ' + brand,
        itemId: id,
        quantity: 1,
        price: price,
      });
  };

  return <></>;
};
