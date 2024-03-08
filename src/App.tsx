import './App.scss';
import { useEffect, useState } from 'react';
import { CoffeListing, CardItem } from './CardItem';
// import { Cart } from './Cart';
import { items } from './data';
// import { faCartShopping } from '@fortawesome/free-solid-svg-icons';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const types = [
  {
    id: 'tass',
    type: 'Tassimo',
  },
  {
    id: 'dolce',
    type: 'Dolce Gusto',
  },
  {
    id: 'ness',
    type: 'Nespresso',
  },
  {
    id: 'lav',
    type: 'Lavazza',
  },
  {
    id: 'sen',
    type: 'Senseo',
  },
  {
    id: 'nessp',
    type: 'Nespresso Pro',
  },
];

export const App = () => {
  const [data, setData] = useState<CoffeListing[]>(items);
  const [type, setType] = useState(types[0].type);
  // const [inCart, setInCart] = useState<Cart[]>([]);
  // const [isCartOpened, setIsCartOpened] = useState<boolean>(false);

  useEffect(() => {
    let newData: CoffeListing[] = [];
    items.map((item: CoffeListing, index: number) => {
      if (item.system == type) {
        item.id = index + 1;
        newData.push(item);
      }
    });

    setData(newData);
  }, [type]);

  useEffect(() => {
    handleCategories(types[0].id, types[0].type);
    // setStateFromLocal();
  }, []);

  // const setStateFromLocal = (): void => {
  //   const localBucket = localStorage.getItem('cart');
  //   if (!localBucket) return;
  //   setInCart(JSON.parse(localBucket));
  // };

  // const handleCartClick = () => {
  //   setIsCartOpened((prevValue) => !prevValue);
  // };

  const handleCategories = (id: string, type: string) => {
    const allBtn = document.getElementsByName('type');

    allBtn.forEach((button: any) => {
      if (button.id != id) button.classList.remove('active');
      else button.classList.add('active');
      scrollToTop();
      setType(type);
    });
  };

  // const handleCardClick = (newItem: Cart) => {
  //   setInCart((prevState) => {
  //     const updatedBucket = prevState.map((item) => {
  //       if (item.itemId === newItem.itemId) {
  //         return {
  //           ...item,
  //           quantity: item.quantity + 1,
  //         };
  //       }
  //       return item;
  //     });
  //     if (!prevState.some((item) => item.itemId === newItem.itemId)) {
  //       updatedBucket.push({
  //         image: newItem.image,
  //         name: newItem.name,
  //         itemId: newItem.itemId,
  //         quantity: 1,
  //         price: newItem.price,
  //       });
  //     }
  //     localStorage.setItem('cart', JSON.stringify(inCart));
  //     return updatedBucket;
  //   });
  // };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  return (
    <div className='container'>
      {/* <div
        className='cart'
        onClick={() => {
          handleCartClick();
        }}
      >
        <FontAwesomeIcon icon={faCartShopping} className='cart__icon' />
        {inCart.length > 0 && (
          <div className='cart__number'>{inCart.length}</div>
        )}
      </div> */}
      {/* {!!isCartOpened ? ( */}
      {/* '' */}
      {/* ) : ( */}
      {/* // <Cart itemsInCart={inCart} /> */}
      <>
        <div className='categories'>
          {types.map((item) => {
            return (
              <button
                key={item.id}
                name='type'
                className='btn'
                id={item.id}
                onClick={() => handleCategories(item.id, item.type)}
              >
                {item.type}
              </button>
            );
          })}
        </div>
        <div className='container__card'>
          {data.map((item: CoffeListing, index: number) => {
            return (
              <CardItem
                key={index}
                coffeeItem={item}
                // onCardClick={handleCardClick}
              />
            );
          })}
        </div>
      </>
      {/* )} */}
    </div>
  );
};
