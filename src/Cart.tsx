import './App.scss';
// import { ItemCard } from './ItemCard';

export type Cart = {
  image: string;
  name: string;
  itemId: number;
  quantity: number;
  price: number;
};

// type CartProps = {
//   itemsInCart: Cart[];
// };

export const Cart = (/*{ itemsInCart }: CartProps*/) => {
  return (
    <>
      {/* {itemsInCart.map((item: Cart) => {
        // return <ItemCard key={item.itemId} coffeeItem={item} />;
      })} */}
    </>
  );
};
