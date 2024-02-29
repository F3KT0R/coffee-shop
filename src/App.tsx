import './App.scss';
import { useEffect, useState } from 'react';
import { CoffeListing, ItemCard } from './ItemCard';
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
    handleCheckboxes(types[0].id, types[0].type);
  }, []);

  const handleCheckboxes = (id: string, type: string) => {
    const allCheck = document.getElementsByName('chk');

    allCheck.forEach((checkbox: any) => {
      if (checkbox.id != id) checkbox.checked = false;
      else checkbox.checked = true;
      setType(type);
    });
  };

  return (
    <div className='container'>
      <div className='checkboxes'>
        {types.map((item) => {
          return (
            <div key={item.id}>
              <label htmlFor={item.id}>{item.type}</label>
              <input
                type='checkbox'
                name='chk'
                id={item.id}
                onClick={() => handleCheckboxes(item.id, item.type)}
              />
            </div>
          );
        })}
      </div>
      <div className='container__card'>
        {data.map((item: CoffeListing, index: number) => {
          return <ItemCard key={index} {...item} />;
        })}
      </div>
    </div>
  );
};
