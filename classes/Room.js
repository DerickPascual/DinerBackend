function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

class Room {
    constructor(roomId, initialMember, restaurants) {
        this.roomId = roomId;
        this.restaurants = shuffleArray(restaurants);
        this.restaurantsHaveDetails = false;
        this.likesAndDislikesTemplate = [];
    
        for (let i = 0; i < this.restaurants.length; i++) {
            this.likesAndDislikesTemplate.push({ likes: 0, dislikes: 0});
        }

        this.members = {};
        this.members[initialMember] = JSON.parse(JSON.stringify(this.likesAndDislikesTemplate));
        this.likesAndDislikes = JSON.parse(JSON.stringify(this.likesAndDislikesTemplate));
        this.nextPageToken = null;
    }

    getRoomId() {
        return this.roomId;
    }

    addMember(member) {
        this.members[member] = JSON.parse(JSON.stringify(this.likesAndDislikesTemplate));
    }

    getMembers() {
        return this.members;
    }

    addMemberLike(member, index) {
        this.members[member][index].likes++;
        this.likesAndDislikes[index].likes++;
    }

    addMemberDislike(member, index) {
        this.members[member][index].dislikes++;
        this.likesAndDislikes[index].dislikes++;
    }

    undoMemberSwipe(member, index) {
        const memberLikeOrDislike = this.members[member][index];

        if (memberLikeOrDislike.likes > 0) {
            memberLikeOrDislike.likes = 0;
            this.likesAndDislikes[index].likes--;
        } else if (memberLikeOrDislike.dislikes > 0) {
            memberLikeOrDislike.dislikes = 0;
            this.likesAndDislikes[index].dislikes--;
        }
    }

    setRestaurants(restaurants) {
        this.restaurants = restaurants;

        return this.restaurants;
    }

    getRestaurants() {
        return this.restaurants;
    }

    addLike(restaurant) {
        this.likesAndDislikes[restaurant]++;

        if (this.likesAndDislikes[restaurant] === this.members.length) {
            return "match";
        }
    }

    getLikes() {
        return this.likesAndDislikes;
    }
}

module.exports = Room;