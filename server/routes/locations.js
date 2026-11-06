const express = require('express');
const router = express.Router();
const districtsData = require('../data/districtsVillages');

// GET all districts
router.get('/districts', (req, res) => {
  const districts = districtsData.map(d => ({
    id: d.districtId,
    name: d.districtName,
    state: d.state,
    villageCount: d.villages.length
  }));
  res.json(districts);
});

// GET villages for a selected district (case/id insensitive)
router.get('/villages', (req, res) => {
  const { district } = req.query;
  if (!district) {
    return res.status(400).json({ error: 'Please specify ?district parameter.' });
  }

  const foundDistrict = districtsData.find(
    d => d.districtId.toLowerCase() === district.toLowerCase() ||
         d.districtName.toLowerCase().includes(district.toLowerCase())
  );

  if (!foundDistrict) {
    return res.json([]);
  }

  res.json(foundDistrict.villages);
});

// GET all locations structure
router.get('/all', (req, res) => {
  res.json(districtsData);
});

module.exports = router;
