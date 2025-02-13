export default {
  $users: {
    allow: {
      view: "auth.id == data.id",
      create: "false",
      delete: "false",
      update: "false",
    },
  },
};
