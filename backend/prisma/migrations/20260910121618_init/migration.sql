-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "discountAmount" DECIMAL(10,2),
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "discountedById" TEXT,
ADD COLUMN     "originalAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "razorpayKeyId" TEXT,
ADD COLUMN     "razorpayKeySecret" TEXT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_discountedById_fkey" FOREIGN KEY ("discountedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
