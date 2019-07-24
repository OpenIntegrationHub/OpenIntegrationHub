/* eslint no-underscore-dangle: "off" */
/* eslint consistent-return: "off" */
/* eslint prefer-destructuring: "off" */

const express = require('express');
const bodyParser = require('body-parser');
const { can } = require('@openintegrationhub/iam-utils');
const config = require('../../config/index');

const storage = require(`./${config.storage}`); // eslint-disable-line

const jsonParser = bodyParser.json();
// const urlParser = bodyParser.urlencoded({ extended: false });
const router = express.Router();

const log = require('../../config/logger'); // eslint-disable-line

// Gets all flows
router.get('/', jsonParser, can(config.logReadPermission), async (req, res) => {
  let pageSize = 10;
  let pageNumber = 1;

  const filters = {};

  let searchString = '';

  // const sortableFields = { timeStamp: 1, service: 1 };
  const sortField = 'createdAt';
  const sortOrder = '-1';

  // page[size]
  if (req.query.page && (req.query.page.size !== undefined && pageSize > 1)) {
    pageSize = parseInt(req.query.page.size, 10);
  }
  // page[number]
  if (req.query.page && (req.query.page.number !== undefined && pageNumber > 0)) {
    pageNumber = parseInt(req.query.page.number, 10);
  }

  // filter[service]
  if (req.query.filter && req.query.filter.service !== undefined) {
    filters.service = req.query.filter.service;
  }

  // Alternative sort orders, currently disabled.
  // // sort timeStamp, service  Prefix -
  // if (req.query.sort !== undefined) {
  //   const array = req.query.sort.split('-');
  //   if (array.length === 1) {
  //     sortField = array[0];
  //     sortOrder = '1';
  //   } else if (array.length === 2) {
  //     sortField = array[1];
  //     sortOrder = '-1';
  //   } else {
  //     error = true;
  //   }
  //   if (!(sortField in sortableFields)) error = true;
  //
  //   if (error && !res.headersSent) {
  //     res.status(400).send('Invalid sort parameter');
  //     return;
  //   }
  // }

  // search
  if (req.query.search !== undefined) {
    searchString = req.query.search.replace(/[^a-z0-9\p{L}\-_\s]/img, '');
    searchString = searchString.replace(/(^[\s]+|[\s]$)/img, '');
  }


  const response = await storage.getLogs(req.user,
    pageSize,
    pageNumber,
    searchString,
    filters,
    sortField,
    sortOrder);

  if (response.data.length === 0 && !res.headersSent) {
    return res.status(404).send({ errors: [{ message: 'No logs found', code: 404 }] });
  } if (!res.headersSent) {
    response.meta.page = pageNumber;
    response.meta.perPage = pageSize;
    response.meta.totalPages = response.meta.total / pageSize;
    res.json(response);
  }
});


module.exports = router;
