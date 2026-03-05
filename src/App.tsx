import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomeScreen } from './components/screens/HomeScreen';
import { SetupScreen } from './components/screens/SetupScreen';
import { GameScreen } from './components/screens/GameScreen';
import { InstructionsScreen } from './components/screens/InstructionsScreen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/setup" element={<SetupScreen />} />
        <Route path="/game" element={<GameScreen />} />
        <Route path="/instructions" element={<InstructionsScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
