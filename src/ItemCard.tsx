import './App.scss';

export type CoffeListing = {
  id?: number;
  notAvailable?: boolean;
  image: string;
  brand: string;
  price: number;
  system: string;
  pods: number;
};

export type Bucket = {
  itemId: number;
  quantity: number;
  unitPrice: number;
};

type ItemCardProps = {
  coffeeItem: CoffeListing;
  // onCardClick: (newItem: Bucket) => void;
};

export const ItemCard = ({ /*onCardClick, */ coffeeItem }: ItemCardProps) => {
  // const handleCardClick = (id: number, price: number) => {
  //   onCardClick({
  //     itemId: id,
  //     quantity: 1,
  //     unitPrice: price,
  //   });
  // };

  return (
    <>
      {!coffeeItem.notAvailable ? (
        <div
          className='card'
          // onClick={() =>
          //   !!coffeeItem.id && handleCardClick(coffeeItem.id, coffeeItem.price)
          // }
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
