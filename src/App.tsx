import './App.scss';
import { useEffect, useState } from 'react';
import { Bucket, CoffeListing, ItemCard } from './ItemCard';
import { items } from './data';

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
  // const [inBucket, setInBucket] = useState<Bucket[]>([]);

  const allData = items;

  useEffect(() => {
    let newData: CoffeListing[] = [];
    allData.map((item: CoffeListing, index: number) => {
      if (item.system == type) {
        item.id = index + 1;
        newData.push(item);
      }
    });

    setData(newData);
  }, [type]);

  useEffect(() => {
    handleCategories(types[0].id, types[0].type);
  }, []);

  const handleCategories = (id: string, type: string) => {
    const allBtn = document.getElementsByName('type');

    allBtn.forEach((button: any) => {
      if (button.id != id) button.classList.remove('active');
      else button.classList.add('active');
      scrollToTop();
      setType(type);
    });
  };

  // const handleCardClick = (newItem: Bucket) => {
  //   setInBucket((prevState) => {
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
  //         itemId: newItem.itemId,
  //         quantity: 1,
  //         unitPrice: newItem.unitPrice,
  //       });
  //     }
  //     return updatedBucket;
  //   });
  // };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  return (
    <div className='container'>
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
            <ItemCard
              key={index}
              coffeeItem={item}
              // onCardClick={handleCardClick}
            />
          );
        })}
      </div>
    </div>
  );
};
