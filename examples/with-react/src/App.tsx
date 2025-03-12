import React, { useState, useEffect } from 'react';
import './App.css';

// Example of a large component that could impact performance
const LargeList = ({ items }: { items: number[] }) => {
  return (
    <div className="large-list">
      {items.map(item => (
        <div key={item} className="list-item">
          Item {item}
        </div>
      ))}
    </div>
  );
};

function App() {
  const [items, setItems] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetching
    const fetchData = async () => {
      // Artificial delay to demonstrate loading state
      await new Promise(resolve => setTimeout(resolve, 1000));
      setItems(Array.from({ length: 1000 }, (_, i) => i + 1));
      setIsLoading(false);
    };

    fetchData();
  }, []);

  return (
    <div className="app">
      <h1>React Performance Example</h1>
      {isLoading ? <div className="loading">Loading...</div> : <LargeList items={items} />}
    </div>
  );
}

export default App;
