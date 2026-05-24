import { ApiProperty } from '@nestjs/swagger';

export class PaymentSessionResponseDto {
  @ApiProperty({
    description: 'Stripe-hosted Checkout URL to redirect the customer to.',
    example: 'https://checkout.stripe.com/c/pay/cs_test_...',
  })
  url: string;

  @ApiProperty({
    description:
      'True when an already-open session was reused instead of creating a new one.',
    example: false,
  })
  reused: boolean;
}
