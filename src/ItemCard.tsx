import './App.scss';

export type CoffeListing = {
  image: string;
  brand: string;
  price: number;
  system: string;
  pods: number;
};

export const ItemCard = (coffee: CoffeListing) => {
  return (
    <div className='card'>
      <h4 className='card__brand'>{coffee.brand}</h4>
      <img
        loading='lazy'
        src={coffee.image}
        alt={coffee.brand}
        className='card__image'
      />
      <h2 className='card__price'>
        {coffee.price} din / {coffee.pods} kapsula
      </h2>
      <h4>
        Za <span className='card__system'>{coffee.system}</span> aparate
      </h4>
    </div>
  );
};
