import { useEffect, useState } from 'react';
import { socketService } from '../services/socket';

const SocketTest = () => {
  const [connection, setConnection] = useState(socketService.getState());

  useEffect(() => {
    return socketService.onStatus(setConnection);
  }, []);

  return <div>Socket: {connection}</div>;
};

export default SocketTest;