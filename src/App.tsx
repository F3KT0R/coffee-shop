import './App.scss';
import { useEffect, useState } from 'react';
import { CoffeListing, CardItem } from './CardItem';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export const types = [
  {
    id: 'tass',
    type: 'tassimo',
    name: 'Tassimo',
  },
  {
    id: 'dolce',
    type: 'dolce-gusto',
    name: 'Dolce Gusto',
  },
  {
    id: 'ness',
    type: 'nespresso',
    name: 'Nespresso',
  },
  {
    id: 'lav',
    type: 'a-modo-mio',
    name: 'Lavazza',
  },
  {
    id: 'sen',
    type: 'senseo',
    name: 'Senseo',
  },
  {
    id: 'nessp',
    type: 'nes-pro',
    name: 'Nespresso Pro',
  },
];

export const App = () => {
  const [data, setData] = useState<CoffeListing[]>([]);
  const [type, setType] = useState(types[0].type);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProductData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://kafeshop-api.netlify.app/sitemap-data?category=${type}&page=${page}`
        );
        if (!response.ok) throw new Error('Network response was not ok');

        const products = await response.json();

        if (data[0]?.system == type) {
          setData((prevData) => prevData.concat(...products.data));
        } else {
          setData(products.data);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching product data:', error);
        setLoading(false);
      }
    };

    fetchProductData();
  }, [type, page]);

  const handleCategories = (id: string, type: string) => {
    const allBtn = document.getElementsByName('type');
    allBtn.forEach((button: any) => {
      if (button.id !== id) button.classList.remove('active');
      else button.classList.add('active');
      scrollToTop();
      setType(type);
      setPage(1);
    });
  };

  const handlePage = (incrementation: number) =>
    setPage((prevValue) => prevValue + incrementation);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  return (
    <div className='container'>
      {loading ? (
        <>
          <div className='backdrop-blur'></div>
          <FontAwesomeIcon className='loading' icon={faSpinner} />
        </>
      ) : (
        ''
      )}
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
              {item.name}
            </button>
          );
        })}
      </div>
      <div className='container__card'>
        {data.length > 0
          ? data.map((item: CoffeListing, index: number) => {
              if (item.image != '')
                return <CardItem key={index} coffeeItem={item} />;
            })
          : ''}
      </div>
      <button className='btn' onClick={() => handlePage(1)}>
        {' '}
        Učitaj još
      </button>
    </div>
  );
};
