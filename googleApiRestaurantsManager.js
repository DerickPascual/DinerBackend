require('dotenv').config();
const { Client } = require("@googlemaps/google-maps-services-js");
const Restaurant = require('./classes/Restaurant.js');
const { setTimeout } = require("timers/promises");

const client = new Client({});

const getRestaurantsFromResults = (results) => {
    const restaurants = []

    // for filtering out fast food restaurants
    const chainCount = [
        { name: "Starbucks", count: "0"  },
        { name: "Mcdonalds", count: "0" },
        { name: "Subway", count: "0" },
        { name: "Olive Garden", count: "0" },
        { name: "Taco Bell", count: "0" }
    ]

    for (const restaurant of results) {

        let repeatChainFound = false;
        for (const chain of chainCount) {
            if (restaurant.name.toUpperCase().includes(chain.name.toUpperCase())) {
                if (chain.count >= 1) {
                    repeatChainFound = true;
                } else {
                    chain.count++;
                }
            }
        }

        if (repeatChainFound) {
            continue;
        }

        const newRestaurant = new Restaurant(
            restaurant.place_id,
            restaurant.name,
            restaurant.rating,
            restaurant.price_level,
            restaurant.user_ratings_total,
        )

        restaurants.push(newRestaurant);
    }

    return restaurants;
}

const getInitialResults = async (lat, lng, radius) => {
    const radiusInMeters = radius * 1609.34;

    const requestParams = {
        location: `${lat},${lng}`,
        type: "restaurant",
        radius: radiusInMeters,
        opennow: true,
        key: process.env.GOOGLE_PLACES_API_KEY
    }

    let results = [];
    let nextPageToken = null;
    let queryLimitHit = false;

    await client.placesNearby({
        params: requestParams
    }).then(async (response) => {
        results = response.data.results;

        nextPageToken = response.data.next_page_token;
    }).catch((err) => {
        console.log(err);

        if (err.response.data.status === 'OVER_QUERY_LIMIT') {
            queryLimitHit = true;
        }
    });

    const returnObj = { results: results, nextPageToken: nextPageToken, queryLimitHit: queryLimitHit };
    return returnObj;
}

const getAdditionalResults = async (pageToken) => {
    if (!pageToken) {
        return;
    }

    const requestParams = {
        pagetoken: pageToken,
        key: process.env.GOOGLE_PLACES_API_KEY
    }

    let returnObj;
    let results = [];
    let nextPageToken = null;
    let queryLimitHit = false;

    await client.placesNearby({
        params: requestParams
    }).then(async (response) => {
        results = response.data.results;

        nextPageToken = response.data.next_page_token;

    }).catch((err) => {
        console.log(err);

        if (err.response.data.status = 'OVER_QUERY_LIMIT') {
            queryLimitHit = true;
        }
    });

    returnObj = { results: results, nextPageToken: nextPageToken, queryLimitHit: queryLimitHit };
    return returnObj;
}

const getRestaurants = async (lat, lng, radius) => {
    if (!lat || !lng || !radius) {
        return { restaurants: [], nextPageToken: null };
    }

    let initialResults = await getInitialResults(lat, lng, radius);

    if (initialResults.queryLimitHit) {
        return { restaurants: [], nextPageToken: null, queryLimitHit: true }
    }

    let additionalResults = { results: [], nextPageToken: null }

    if (initialResults.nextPageToken) {
        await setTimeout(3000);
        additionalResults = await getAdditionalResults(initialResults.nextPageToken);
    }

    if (additionalResults.queryLimitHit) {
        return { restaurants: [], nextPageToken: null, queryLimitHit: true }
    }

    const restaurants = getRestaurantsFromResults([...initialResults.results, ...additionalResults.results]);

    return { restaurants: restaurants, nextPageToken: additionalResults.nextPageToken, queryLimitHit: false }
}

module.exports = { getRestaurants };