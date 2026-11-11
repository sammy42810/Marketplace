export const LISTINGS_INDEX = "listings";

export const LISTINGS_MAPPING = {
  mappings: {
    properties: {
      title: {
        type: "text",
        fields: {
          autocomplete: { type: "search_as_you_type" },
        },
      },
      description: {
        type: "text",
        fields: {
          autocomplete: { type: "search_as_you_type" },
        },
      },
      category: { type: "keyword" },
      condition: { type: "keyword" },
      saleType: { type: "keyword" },
      status: { type: "keyword" },
      price: { type: "double" },
      location: { type: "geo_point" },
      createdAt: { type: "date" },
    },
  },
};
