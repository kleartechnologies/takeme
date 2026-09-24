# Auction discovery price and inventory

An auction's `startingBid` is a positive integer number of MYR sen and remains the initial bid threshold. Zero is invalid in the existing server validator and Firestore schema. The observed RM0 local item is invalid fixture/legacy data, not a free-auction product rule; active discovery excludes it. No production records were changed.

Cards/detail display `currentBid` when `bidCount > 0`, otherwise `startingBid`, explicitly labelled “current bid” or “starting bid”. The indexed `listings.price` field is the mixed-feed discovery amount in ringgit: starting bid at creation, updated atomically to the accepted current bid by `placeBid`. Thus price sort and maximum-price query match what buyers see; fixed-price listings retain their listed price. `currentBid` and `startingBid` remain integer-sen auction authority and bid validation never relies on `price`.

Existing auctions created before the bid-path update may have a stale indexed `price` after bidding. A reviewed one-time backfill of `price = currentBid / 100` for valid auction records with bids is a production prerequisite before asserting global price-sort correctness. Do not run it blindly; verify each record's bid count, positive sen values, auction status and finalization first. This phase neither migrates production nor deploys.

The active Explore feed additionally filters auction status, positive starting bid, valid current bid and `auctionEndAt > now` while paging. This guards against scheduler lag and malformed fixtures without changing the authoritative finalization scheduler. A scheduled auction may appear in discovery before bidding opens; expired/finalized/cancelled auctions do not appear as active inventory.
