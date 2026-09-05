import React, { useState, useEffect } from 'react';

interface Props {
  onLogin: () => void;
  correctPin: string;
}

const Login: React.FC<Props> = ({ onLogin, correctPin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    if (isBlocked && timer > 0) {
      const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    } else if (timer === 0) {
      setIsBlocked(false);
      setAttempts(0);
      setTimer(30);
    }
  }, [isBlocked, timer]);

  const handleInput = (num: string) => {
    if (isBlocked) return;
    const newPin = (pin + num).slice(0, 4);
    setPin(newPin);
    if (newPin.length === 4) {
      if (newPin === correctPin) {
        onLogin();
      } else {
        setError('PIN incorrecto');
        setPin('');
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 5) {
          setIsBlocked(true);
          setError('Demasiados intentos. Bloqueado 30s');
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-80 text-center">
        <h1 className="text-2xl font-bold mb-6">Gestión de Operarios - Maquinaría Amarilla</h1>
        <input type="password" value={pin} readOnly className="w-full text-center text-4xl mb-6 p-2 border rounded tracking-widest" />
        {isBlocked ? <p className="text-red-600 mb-4 font-bold">{timer}s</p> : <p className="text-red-600 mb-4 h-6">{error}</p>}
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3,4,5,6,7,8,9,0].map(n => (
            <button key={n} onClick={() => handleInput(n.toString())} disabled={isBlocked} className="p-4 bg-gray-200 rounded text-xl font-bold hover:bg-gray-300">{n}</button>
          ))}
          <button onClick={() => setPin('')} disabled={isBlocked} className="col-start-2 p-4 bg-red-100 text-red-600 rounded font-bold">C</button>
        </div>
      </div>
    </div>
  );
};

export default Login;
