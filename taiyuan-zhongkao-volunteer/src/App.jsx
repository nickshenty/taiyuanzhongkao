import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/common/Layout'
import Home from './pages/Home'
import SchoolDetail from './pages/SchoolDetail'
import DataCompare from './pages/DataCompare'
import Profile from './pages/Profile'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/school/:code" element={<SchoolDetail />} />
          <Route path="/compare" element={<DataCompare />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<h1>页面不存在</h1>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
